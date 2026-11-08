const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 10 * 1024 * 1024;

async function atomicWrite(destination, data) {
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temp = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temp, 'wx', 0o600);
    await handle.writeFile(data, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temp, destination);
    // Sync the containing directory so a successful rename is durable too.
    let directory;
    try {
      directory = await fs.open(path.dirname(destination), 'r');
      await directory.sync();
    } catch (error) {
      if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error;
    } finally {
      await directory?.close();
    }
  } finally {
    await handle?.close();
    await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function readBounded(file, limit = MAX_BYTES) {
  let handle;
  try {
    handle = await fs.open(file, 'r');
    if ((await handle.stat()).size > limit) throw new Error(`文件超过 ${Math.floor(limit / 1024 / 1024)} MB 限制`);
    const data = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(data, 'utf8') > limit) throw new Error('文件过大');
    return data;
  } finally {
    await handle?.close();
  }
}

function createStore({ directory, validate, maxBytes = MAX_BYTES }) {
  const filename = path.join(directory, 'state.json');
  const backup = path.join(directory, 'state.backup.json');
  let queue = Promise.resolve();
  let initialized = false;
  let recovery = null;

  const enqueue = work => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };

  function encode(input) {
    const value = validate(input);
    const json = JSON.stringify(value, null, 2);
    if (Buffer.byteLength(json, 'utf8') > maxBytes) throw new Error('数据超过本地存储大小限制，尚未保存');
    return { value, json };
  }

  async function read(file) {
    try {
      const raw = await readBounded(file, maxBytes);
      return { exists: true, ...encode(JSON.parse(raw)) };
    } catch (error) {
      if (error.code === 'ENOENT') return { exists: false };
      return { exists: true, error };
    }
  }

  async function loadInternal() {
    const main = await read(filename);
    if (main.exists && !main.error) {
      initialized = true;
      return main.value;
    }
    const prior = await read(backup);
    if (!main.exists && !prior.exists) {
      initialized = true;
      return null;
    }
    if (prior.exists && !prior.error) {
      let preserved = null;
      if (main.exists) {
        preserved = `${filename}.corrupt-${Date.now()}-${crypto.randomUUID()}`;
        await fs.rename(filename, preserved);
      }
      await atomicWrite(filename, prior.json);
      recovery = { originalPath: preserved, restoredFrom: backup };
      initialized = true;
      return prior.value;
    }
    throw new Error('本地数据无法读取，且没有可用备份。原文件已保留，请先恢复备份；应用不会覆盖这些数据。');
  }

  return {
    filename,
    backup,
    get recovery() { return recovery; },
    load: () => enqueue(loadInternal),
    flush: () => queue,
    save: input => {
      // Snapshot at the call boundary, so subsequent caller mutations cannot
      // alter a queued write.
      let snapshot;
      try { snapshot = encode(input); } catch (error) { return Promise.reject(error); }
      return enqueue(async () => {
        if (!initialized) await loadInternal();
        const current = await read(filename);
        if (!current.exists || current.error) {
          // Reconcile externally corrupted files before any replacement.
          await loadInternal();
        }
        const previous = await read(filename);
        if (previous.error) throw new Error('保存前发现数据文件发生变化，已停止写入并保留原文件');
        await atomicWrite(backup, previous.exists ? previous.json : snapshot.json);
        await atomicWrite(filename, snapshot.json);
      });
    },
    validate: input => encode(input).value,
  };
}

module.exports = { createStore, atomicWrite, readBounded, MAX_BYTES };
