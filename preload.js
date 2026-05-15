const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  updateTrayTitle: (title) => ipcRenderer.invoke('update-tray-title', title)
});
