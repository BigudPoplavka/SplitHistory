const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vaultAPI', {
  load: () => ipcRenderer.invoke('vault:load'),
  save: (data) => ipcRenderer.invoke('vault:save', data),
  saveAs: (data) => ipcRenderer.invoke('vault:save-as', data),
  open: () => ipcRenderer.invoke('vault:open'),
  onMenuSave: (callback) => ipcRenderer.on('menu:save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu:save-as', callback),
  onMenuOpen: (callback) => ipcRenderer.on('menu:open', callback),

  attachmentAdd: (noteId) => ipcRenderer.invoke('attachment:add', noteId),
  attachmentOpen: (filePath) => ipcRenderer.invoke('attachment:open', filePath),
  photoSet: (noteId) => ipcRenderer.invoke('photo:set', noteId),
  openExternalLink: (url) => ipcRenderer.invoke('link:open-external', url),

  exportFile: (defaultName, content) => ipcRenderer.invoke('file:export', defaultName, content),
  importBibTeX: () => ipcRenderer.invoke('file:import-bibtex'),
  onMenuExport: (callback) => ipcRenderer.on('menu:export', callback),
  onMenuImportBibtex: (callback) => ipcRenderer.on('menu:import-bibtex', callback)
});
