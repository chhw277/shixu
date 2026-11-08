const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createStore, readBounded } = require('../electron/store.cjs');

const validate = value => {
  if (!value || value.version !== 1 || !Array.isArray(value.tasks) || !value.tasks.every(x => typeof x.title === 'string')) throw new Error('数据格式无效');
  return structuredClone(value);
};
const state = title => ({ version: 1, tasks: [{ title }] });

async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shixu-store-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createStore({ directory, validate, ...options });
  return { directory, store };
}

test('first load is empty; first and subsequent writes survive a new store instance', async t => {
  const { directory, store } = await fixture(t);
  assert.equal(await store.load(), null);
  await store.save(state('第一次'));
  assert.deepEqual(JSON.parse(await fs.readFile(store.backup, 'utf8')), state('第一次'));
  assert.deepEqual(await createStore({ directory, validate }).load(), state('第一次'));
  await store.save(state('第二次'));
  assert.deepEqual(JSON.parse(await fs.readFile(store.backup, 'utf8')), state('第一次'));
  assert.deepEqual(await createStore({ directory, validate }).load(), state('第二次'));
  assert.deepEqual((await fs.readdir(directory)).sort(), ['state.backup.json', 'state.json']);
});

test('concurrent writes are ordered and snapshot mutable inputs at invocation', async t => {
  const { store } = await fixture(t);
  const a = state('A');
  const calls = [store.save(a), store.save(state('B')), store.save(state('C'))];
  a.tasks[0].title = 'mutated';
  await Promise.all(calls);
  assert.deepEqual(await store.load(), state('C'));
  assert.deepEqual(JSON.parse(await fs.readFile(store.backup, 'utf8')), state('B'));
});

test('flush waits for all accepted writes before application quit', async t => {
  const { store } = await fixture(t);
  const saves = Array.from({ length: 12 }, (_, index) => store.save(state(`write ${index}`)));
  await store.flush();
  assert.deepEqual(JSON.parse(await fs.readFile(store.filename, 'utf8')), state('write 11'));
  await Promise.all(saves);
});

test('corrupt main is preserved and recovered from the last valid backup', async t => {
  const { directory, store } = await fixture(t);
  await store.save(state('safe'));
  await store.save(state('newer'));
  await fs.writeFile(store.filename, '{truncated');
  const recovered = createStore({ directory, validate });
  assert.deepEqual(await recovered.load(), state('safe'));
  assert.equal(recovered.recovery.restoredFrom, store.backup);
  assert.match(recovered.recovery.originalPath, /state\.json\.corrupt-/);
  const corrupt = (await fs.readdir(directory)).find(x => x.startsWith('state.json.corrupt-'));
  assert.ok(corrupt);
  assert.equal(await fs.readFile(path.join(directory, corrupt), 'utf8'), '{truncated');
  assert.deepEqual(JSON.parse(await fs.readFile(store.filename, 'utf8')), state('safe'));
});

test('missing main recovers from backup instead of resetting to seed', async t => {
  const { directory, store } = await fixture(t);
  await store.save(state('saved'));
  await store.save(state('newer'));
  await fs.unlink(store.filename);
  assert.deepEqual(await createStore({ directory, validate }).load(), state('saved'));
});

test('double corruption refuses load and save and never overwrites originals', async t => {
  const { directory, store } = await fixture(t);
  await fs.writeFile(store.filename, 'bad main');
  await fs.writeFile(store.backup, 'bad backup');
  const next = createStore({ directory, validate });
  await assert.rejects(next.load(), /原文件已保留/);
  await assert.rejects(next.save(state('would overwrite')), /原文件已保留/);
  assert.equal(await fs.readFile(store.filename, 'utf8'), 'bad main');
  assert.equal(await fs.readFile(store.backup, 'utf8'), 'bad backup');
});

test('invalid save does not poison queued valid writes or alter existing data', async t => {
  const { store } = await fixture(t);
  await store.save(state('valid'));
  await assert.rejects(store.save({ version: 99, tasks: [] }), /格式无效/);
  assert.deepEqual(await store.load(), state('valid'));
  await store.save(state('after invalid'));
  assert.deepEqual(await store.load(), state('after invalid'));
});

test('valid JSON with an invalid schema is corrupt and refuses replacement without backup', async t => {
  const { directory, store } = await fixture(t);
  const original = JSON.stringify({ version: 1, tasks: ['invalid'] });
  await fs.writeFile(store.filename, original);
  const next = createStore({ directory, validate });
  await assert.rejects(next.load(), /无法读取/);
  await assert.rejects(next.save(state('replacement')), /无法读取/);
  assert.equal(await fs.readFile(store.filename, 'utf8'), original);
});

test('oversized inputs and oversized files are rejected before replacement', async t => {
  const { store } = await fixture(t, { maxBytes: 150 });
  await store.save(state('within limit'));
  await assert.rejects(store.save(state('大'.repeat(200))), /大小限制/);
  assert.deepEqual(await store.load(), state('within limit'));
  await fs.writeFile(store.filename, 'x'.repeat(200));
  await assert.rejects(readBounded(store.filename, 150), /限制/);
});

test('an externally corrupted main cannot be overwritten by an initialized store', async t => {
  const { store } = await fixture(t);
  await store.save(state('first'));
  await fs.writeFile(store.filename, 'corrupt');
  await fs.writeFile(store.backup, 'corrupt backup');
  await assert.rejects(store.save(state('second')), /无法读取/);
  assert.equal(await fs.readFile(store.filename, 'utf8'), 'corrupt');
});

test('a removed main and corrupt backup cannot be overwritten by an initialized store', async t => {
  const { store } = await fixture(t);
  await store.save(state('first'));
  await fs.unlink(store.filename);
  await fs.writeFile(store.backup, 'corrupt backup');
  await assert.rejects(store.save(state('second')), /无法读取/);
  await assert.rejects(fs.access(store.filename), { code: 'ENOENT' });
  assert.equal(await fs.readFile(store.backup, 'utf8'), 'corrupt backup');
});

test('first write has a recoverable backup even before a second write', async t => {
  const { directory, store } = await fixture(t);
  await store.save(state('first and only'));
  await fs.writeFile(store.filename, 'corrupt');
  assert.deepEqual(await createStore({ directory, validate }).load(), state('first and only'));
});

test('the previous valid file survives an oversized disk file through backup recovery', async t => {
  const { directory, store } = await fixture(t, { maxBytes: 150 });
  await store.save(state('first'));
  await store.save(state('second'));
  await fs.writeFile(store.filename, 'x'.repeat(500));
  assert.deepEqual(await createStore({ directory, validate, maxBytes: 150 }).load(), state('first'));
});

test('production domain state round-trips through the desktop disk store', async t => {
  const { createInitialState, validateState, reducer } = await import('../src/model.js');
  const { directory, store } = await fixture(t, { validate: validateState });
  const initial = createInitialState(new Date(2026, 10, 8, 12, 0));
  const updated = reducer(initial, { type: 'TASK_ADD', task: { title: '跨桌面重启保留的任务' } });
  await store.save(updated);
  const reopened = await createStore({ directory, validate: validateState }).load();
  assert.deepEqual(reopened, updated);
  assert.ok(reopened.tasks.some(task => task.title === '跨桌面重启保留的任务'));
});

test('a rejected single-instance lock cannot prepare storage or create a second window', async () => {
  const listeners = new Map();
  let quitCalls = 0;
  const app = {
    setName() {}, setPath() {}, getPath() { return os.tmpdir(); },
    requestSingleInstanceLock() { return false; },
    quit() { quitCalls++; },
    on(event, callback) { listeners.set(event, callback); },
    isReady() { return true; },
    whenReady() { throw new Error('a second instance must not enter startup'); },
  };
  const electron = {
    app,
    BrowserWindow: class { constructor() { throw new Error('a second instance must not create windows'); } },
    ipcMain: {}, dialog: {}, Notification: {}, Menu: {},
  };
  const source = await fs.readFile(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  vm.runInNewContext(source, {
    require: name => name === 'electron' ? electron : name === './store.cjs' ? require('../electron/store.cjs') : require(name),
    __dirname: path.join(__dirname, '../electron'), process: { env: {} }, console,
  });
  assert.equal(quitCalls, 1);
  listeners.get('activate')();
  assert.equal(quitCalls, 1);
});
