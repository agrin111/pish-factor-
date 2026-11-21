const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pishfactorDesktop', {
  isDesktop: true,
  getUpdateState: () => ipcRenderer.invoke('updater:state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  openReleasesPage: () => ipcRenderer.invoke('updater:open-releases'),
  onUpdateState: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('updater:state-changed', handler);
    return () => ipcRenderer.removeListener('updater:state-changed', handler);
  },
});
