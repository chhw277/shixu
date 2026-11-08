const { app, BrowserWindow, ipcMain, dialog, Notification, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createStore, atomicWrite, readBounded, MAX_BYTES } = require('./store.cjs');

app.setName('拾序');
if (process.platform === 'win32') app.setAppUserModelId('local.shixu.desktop');
app.setPath('userData', process.env.SHIXU_TEST_DATA_DIR || path.join(app.getPath('appData'), '拾序'));
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

const DEV_URL = 'http://127.0.0.1:5173';
const productionURL = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
const isDevelopment = !app.isPackaged && process.env.SHIXU_DEV === '1';
let window;
let store;
let reminderTimer;
let notificationLedger = {};
let reminderBusy = false;
let quitting = false;
let recoveryReported = false;

function allowedURL(raw) {
  try {
    const url = new URL(raw);
    if (isDevelopment) return url.origin === DEV_URL;
    return url.protocol === 'file:' && `${url.origin}${url.pathname}` === `${new URL(productionURL).origin}${new URL(productionURL).pathname}`;
  } catch { return false; }
}

function checkedHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !allowedURL(event.senderFrame.url)) {
      throw new Error('无法处理来自非应用页面的请求');
    }
    return handler(...args);
  });
}

function notify(payload) {
  if (!payload || typeof payload.title !== 'string' || typeof payload.body !== 'string') throw new Error('通知格式无效');
  if (!Notification.isSupported()) return false;
  const item = new Notification({ title: payload.title.slice(0, 120), body: payload.body.slice(0, 800), silent: false });
  item.on('click', () => { window?.show(); window?.focus(); });
  item.show();
  return true;
}

async function checkReminders() {
  if (reminderBusy || quitting) return;
  reminderBusy = true;
  try {
    const state = await store.load();
    if (!state) return;
    const now = Date.now();
    let changed = false;
    for (const task of state.tasks) {
      if (task.deleted || task.completed || !task.reminder) continue;
      const time = Date.parse(task.reminder);
      const key = `${task.id}|${task.reminder}`;
      if (!Number.isFinite(time) || time > now || notificationLedger[key]) continue;
      if (notify({ title: '拾序 · 任务提醒', body: task.title })) {
        notificationLedger[key] = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      const recent = Object.entries(notificationLedger).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 10000);
      notificationLedger = Object.fromEntries(recent);
      await atomicWrite(path.join(app.getPath('userData'), 'notifications.json'), JSON.stringify(notificationLedger));
    }
  } catch (error) {
    console.error('[reminder]', error.message);
  } finally { reminderBusy = false; }
}

function createWindow() {
  window = new BrowserWindow({
    width: 1380, height: 880, minWidth: 1000, minHeight: 680,
    show: false, title: '拾序',
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 20 } } : {}),
    backgroundColor: '#FAFAF9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true,
      spellcheck: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!allowedURL(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting) dialog.showErrorBox('界面已停止', `界面进程意外退出（${details.reason}）。已保存的数据仍在本地，重新打开应用即可继续。`);
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  window.loadURL(isDevelopment ? DEV_URL : productionURL).catch(error => dialog.showErrorBox('无法打开界面', error.message));
}

app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  clearInterval(reminderTimer);
  Promise.resolve(store?.flush()).finally(() => app.quit());
});
app.on('activate', () => { if (hasInstanceLock && app.isReady() && !window && !quitting && store) createWindow(); });

if (hasInstanceLock) app.whenReady().then(async () => {
  const { validateState } = await import('../src/model.js');
  store = createStore({ directory: path.join(app.getPath('userData'), 'data'), validate: validateState });
  const ledgerFile = path.join(app.getPath('userData'), 'notifications.json');
  try {
    const ledger = JSON.parse(await readBounded(ledgerFile, 2 * 1024 * 1024));
    if (ledger && !Array.isArray(ledger) && typeof ledger === 'object') notificationLedger = Object.fromEntries(Object.entries(ledger).filter(([key, value]) => key.length < 1000 && typeof value === 'string'));
  } catch (error) { if (error.code !== 'ENOENT') console.error('[notifications]', error.message); }

  checkedHandler('data:load', async () => {
    const state = await store.load();
    if (store.recovery && !recoveryReported) {
      recoveryReported = true;
      dialog.showMessageBox(window, {
        type: 'warning', title: '已从自动备份恢复', message: '本地数据文件异常，已恢复最近一次可用的自动备份。',
        detail: `备份可能不包含最后一次修改。${store.recovery.originalPath ? '损坏原文件已单独保留。' : '原数据文件缺失。'}\n自动备份：${store.recovery.restoredFrom}`,
        buttons: ['知道了'],
      }).catch(error => console.error('[recovery notice]', error.message));
    }
    return state;
  });
  checkedHandler('data:save', async state => { await store.save(state); });
  checkedHandler('data:path', () => store.filename);
  checkedHandler('notification:show', payload => notify(payload));
  checkedHandler('data:export', async input => {
    const state = store.validate(input);
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: '导出拾序备份', defaultPath: `拾序备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: '拾序数据', extensions: ['json'] }],
    });
    if (canceled || !filePath) return false;
    await atomicWrite(filePath, JSON.stringify(state, null, 2));
    return true;
  });
  checkedHandler('data:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: '导入拾序备份', properties: ['openFile'], filters: [{ name: '拾序数据', extensions: ['json'] }],
    });
    if (canceled || !filePaths[0]) return null;
    let decoded;
    try { decoded = JSON.parse(await readBounded(filePaths[0], MAX_BYTES)); }
    catch (error) { throw new Error(`无法读取备份：${error.message}`); }
    return store.validate(decoded);
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '拾序', submenu: [{ role: 'about', label: '关于拾序' }, { type: 'separator' }, ...(process.platform === 'darwin' ? [{ role: 'hide', label: '隐藏拾序' }, { role: 'hideOthers', label: '隐藏其他应用' }, { type: 'separator' }] : []), { role: 'quit', label: '退出拾序' }] },
    { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
    { label: '视图', submenu: [{ role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' }] },
    { label: '窗口', submenu: [{ role: 'minimize', label: '最小化' }, { role: 'close', label: '关闭窗口' }] },
  ]));
  createWindow();
  reminderTimer = setInterval(checkReminders, 15000);
  setTimeout(checkReminders, 5000);
}).catch(error => { dialog.showErrorBox('拾序未能启动', error.message); app.quit(); });
