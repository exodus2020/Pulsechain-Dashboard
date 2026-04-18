const { contextBridge, ipcRenderer } = require('electron')


contextBridge.exposeInMainWorld('electron', {
  ping: () => 'pong',
  loadFile: (filename) => ipcRenderer.invoke('load-file', filename),
  saveFile: (filename, data) => ipcRenderer.invoke('save-file', filename, data),
  deleteFile: (filename) => ipcRenderer.invoke('delete-file', filename),
  checkVersion: (folder) => ipcRenderer.invoke('checkVersion', folder),
  getFile: (url) => ipcRenderer.invoke('getFile', url),
  serveWebapp: (folder, port, buildPath) => ipcRenderer.invoke('serve-webapp', folder, port, buildPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  cloneRepo: (repoUrl, folder) => ipcRenderer.invoke('clone-repo', repoUrl, folder),
  stopServer: (folder) => ipcRenderer.invoke('stop-server', folder),
  toggleMode: (height, width) => ipcRenderer.invoke('toggle-mode', height, width),
  getMode: () => ipcRenderer.invoke('get-mode'),
})