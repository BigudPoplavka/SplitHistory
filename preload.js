const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vaultAPI', {
  load: () => ipcRenderer.invoke('vault:load'),
  save: (data) => ipcRenderer.invoke('vault:save', data),
  saveAs: (data) => ipcRenderer.invoke('vault:save-as', data),
  open: () => ipcRenderer.invoke('vault:open'),
  onMenuSave: (callback) => ipcRenderer.on('menu:save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu:save-as', callback),
  onMenuOpen: (callback) => ipcRenderer.on('menu:open', callback)
});
