const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  platform: process.platform,
  load: () => ipcRenderer.invoke('data:load'),
  save: state => ipcRenderer.invoke('data:save', state),
  exportData: state => ipcRenderer.invoke('data:export', state),
  importData: () => ipcRenderer.invoke('data:import'),
  notify: payload => ipcRenderer.invoke('notification:show', payload),
  dataPath: () => ipcRenderer.invoke('data:path'),
}));
