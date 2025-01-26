// preload.js
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

// Preload PNG images from icons folder
const loadIconImages = () => {
  const iconsPath = path.join(__dirname, 'icons')
  const iconFiles = {}

  try {
    const files = fs.readdirSync(iconsPath)
    files.forEach(file => {
      if (file.toLowerCase().endsWith('.png')) {
        const filePath = path.join(iconsPath, file)
        const fileData = fs.readFileSync(filePath)
        const base64Data = fileData.toString('base64')
        iconFiles[file] = `data:image/png;base64,${base64Data}`
      }
    })
  } catch (error) {
    console.error('Error loading icons:', error)
  }

  return iconFiles
}

contextBridge.exposeInMainWorld('electron', {
  icons: loadIconImages(),

  loadFile: (filename) => ipcRenderer.invoke('load-file', filename),
  saveFile: (filename, data) => ipcRenderer.invoke('save-file', filename, data),
  deleteFile: (filename) => ipcRenderer.invoke('delete-file', filename),
  checkVersion: (folder) => ipcRenderer.invoke('checkVersion', folder),
  getFile: (url) => ipcRenderer.invoke('getFile', url),
  serveWebapp: (folder, port) => ipcRenderer.invoke('serve-webapp', folder, port),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  cloneRepo: (repoUrl, folder) => ipcRenderer.invoke('clone-repo', repoUrl, folder),
  stopServer: (folder) => ipcRenderer.invoke('stop-server', folder)
})