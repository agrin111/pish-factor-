const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pishfactorDesktop', {
  isDesktop: true,
  getUpdateState: () => ipcRenderer.invoke('updater:state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  openReleasesPage: () => ipcRenderer.invoke('updater:open-releases'),
  printDocument: (pageSize) => ipcRenderer.invoke('print:document', { pageSize }),
  savePdf: (bytes, defaultFileName) =>
    ipcRenderer.invoke('file:save-pdf', { bytes, defaultFileName }),
  openFilePath: (filePath) => ipcRenderer.invoke('file:open-path', filePath),
  saveSharePdf: (bytes, defaultFileName) =>
    ipcRenderer.invoke('file:save-share-pdf', { bytes, defaultFileName }),
  showItemInFolder: (filePath) => ipcRenderer.invoke('file:show-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  onUpdateState: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('updater:state-changed', handler);
    return () => ipcRenderer.removeListener('updater:state-changed', handler);
  },
});
