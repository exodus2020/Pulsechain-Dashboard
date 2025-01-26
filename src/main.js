const { app, BrowserWindow, ipcMain, shell, screen } = require('electron')
const path = require('path')
const http = require('http')
const express = require('express')
const fsPromises = require('fs').promises
const fs = require('fs')
const git = require('isomorphic-git')
const http2 = require('isomorphic-git/http/node')
const isDev = process.env.NODE_ENV === 'development'
const fetch = require('node-fetch')

function createWindow() {
  // Get the primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const win = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 900,
    minHeight: 600,
    icon: process.platform === 'darwin' 
      ? path.join(__dirname, 'icons/logo.icns')  // for macOS
      : path.join(__dirname, 'icons/logo64x64.png'), // for Windows/Linux
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('clone-repo', async (event, repoUrl, folder) => {
  try {
    const baseDir = path.join(app.getPath('userData'), 'public')
    const targetDir = path.join(baseDir, folder)
    
    // Ensure base directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }

    // Remove existing directory if it exists
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // Create target directory
    fs.mkdirSync(targetDir, { recursive: true })

    // Clone repository using isomorphic-git
    await git.clone({
      fs,
      http: http2,
      dir: targetDir,
      url: repoUrl,
      singleBranch: true,
      depth: 1
    })

    return 'Clone successful'
  } catch (error) {
    console.error('Clone error:', error)
    throw error
  }
})

const servers = new Map()

ipcMain.handle('serve-webapp', async (event, folder, port) => {
  return new Promise((resolve, reject) => {
    // Stop existing server for this folder if it exists
    if (servers.has(folder)) {
      servers.get(folder).close()
      servers.delete(folder)
    }

    const expressApp = express()
    const publicPath = path.join(app.getPath('userData'), 'public', folder, 'pkg', 'app', 'dist')
    
    // Check if the directory exists
    if (!fs.existsSync(publicPath)) {
      reject(new Error(`Directory not found: ${publicPath}`))
      return
    }

    expressApp.use(express.static(publicPath))

    const server = http.createServer(expressApp)
    server.listen(port, (err) => {
      if (err) {
        reject(err)
        return
      }
      servers.set(folder, server)
      resolve('Server started successfully')
    })
  })
})

// Clean up all servers on app quit
app.on('before-quit', () => {
  for (const server of servers.values()) {
    server.close()
  }
})

ipcMain.handle('stop-server', async (event, folder) => {
  return new Promise((resolve, reject) => {
    if (servers.has(folder)) {
      servers.get(folder).close(() => {
        servers.delete(folder)
        resolve('Server stopped successfully')
      })
    } else {
      resolve('No server running')
    }
  })
})

ipcMain.handle('checkVersion', async (event, folder) => {
  // Valid paths for gitlab builds and repos are /pkg/app/dish and /build
  try {
    const versionPath = path.join(
      app.getPath('userData'),
      'public',
      folder,
      'pkg',
      'app',
      'dist',
      'version.json'
    )

    const versionPathV2 = path.join(
      app.getPath('userData'),
      'public',
      folder,
      'build',
      'version.json'
    )

    let version = undefined
    try {
      version = await fsPromises.readFile(versionPath, 'utf8')
    } catch {
      version = await fsPromises.readFile(versionPathV2, 'utf8')
    }

    return JSON.parse(version)
    
  } catch (error) {
    return null
  }
})

ipcMain.handle('getFile', async (event, url) => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return await response.json()
    }

    // Try to parse as JSON even if content-type is not JSON
    try {
      const text = await response.text()
      console.log(text)
      return JSON.parse(text)
    } catch (parseError) {
      console.warn('Failed to parse response as JSON:', parseError)
      return null
    }

  } catch (error) {
    console.warn('Error fetching file:', error)
    return null
  }
})

ipcMain.handle('open-external', async (event, url) => {
  return shell.openExternal(url)
})

ipcMain.handle('save-file', async (event, filename, data) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename)
    await fsPromises.writeFile(filePath, data, 'utf8')
    return true
  } catch (error) {
    console.error('Error saving file:', error)
    return false
  }
})

ipcMain.handle('load-file', async (event, filename) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename)
    const data = await fsPromises.readFile(filePath, 'utf8')
    return data
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined // File doesn't exist
    }
    console.error('Error loading file:', error)
    throw error
  }
})

ipcMain.handle('delete-file', async (event, filename) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename)
    await fsPromises.unlink(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true // File doesn't exist, consider it a success
    }
    console.error('Error deleting file:', error)
    return false
  }
})