// main.js
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

let mainWindow = null
const defaultConfig = {
    width: 900,
    height: 950,
    minWidth: 900,
    minHeight: 950,
    alwaysOnTop: false,
    frame: true
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    console.log('MAIN __dirname:', __dirname)
    console.log('PRELOAD PATH:', require('path').resolve(__dirname, 'preload.js'))
    mainWindow = new BrowserWindow({
        ...defaultConfig,
        height,
        width,
        icon: process.platform === 'darwin' 
            ? path.join(__dirname, 'icons/logo.icns')
            : path.join(__dirname, 'icons/logo64x64.png'),
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true
        }
    })

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173')
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
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

ipcMain.handle('serve-webapp', async (event, folder, port, buildPath) => {
  return new Promise((resolve, reject) => {
    // Stop existing server for this folder if it exists
    if (servers.has(folder)) {
      servers.get(folder).close()
      servers.delete(folder)
    }

    const expressApp = express()
    const publicPath = !buildPath 
       ? path.join(app.getPath('userData'), 'public', folder, 'pkg', 'app', 'dist')
       : path.join(app.getPath('userData'), 'public', folder, buildPath)
    
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://pulsecoinlist.com/',
        'Origin': 'https://pulsecoinlist.com'
      }
    })

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()

    console.log('getFile DEBUG', {
      url,
      status: response.status,
      ok: response.ok,
      contentType,
      preview: text.slice(0, 300)
    })

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`)
    }

    try {
    return JSON.parse(text)
  } catch (parseError) {
    try {
      const nextDataMatch = text.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      )

      if (nextDataMatch?.[1]) {
        return JSON.parse(nextDataMatch[1])
      }

      console.warn('Failed to parse response as JSON or __NEXT_DATA__:', parseError)
      return null
    } catch (htmlParseError) {
      console.warn('Failed to extract __NEXT_DATA__ from HTML:', htmlParseError)
      return null
    }
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

function toggleMode (width, height) {
  if (!mainWindow) return false

  const currentMode = mainWindow.isAlwaysOnTop()
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  
  if (currentMode) {
      // Switch back to default mode
      mainWindow.setAlwaysOnTop(false)
      mainWindow.setMaximumSize(2147483647, 2147483647) // Reset max size first
      mainWindow.setMinimumSize(defaultConfig.width, defaultConfig.height)
      mainWindow.setSize(defaultConfig.width, defaultConfig.height, true) // true forces immediate resize
      mainWindow.setAutoHideMenuBar(false)
      mainWindow.setMenuBarVisibility(true)
      
      // Center the window
      const x = Math.floor((screenWidth - defaultConfig.width) / 2)
      const y = Math.floor((screenHeight - defaultConfig.height) / 2)
      mainWindow.setPosition(x, y, true)
  } else {
      // Switch to custom mode
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      mainWindow.setMinimumSize(width, height)
      mainWindow.setMaximumSize(width, height)
      mainWindow.setSize(width, height, true) // true forces immediate resize
      mainWindow.setAutoHideMenuBar(true)
      mainWindow.setMenuBarVisibility(false)
      
      // Position in lower right corner with 20px padding
      const x = screenWidth - width
      const y = screenHeight - height
      mainWindow.setPosition(x, y, true)
  }
  
  return !currentMode
}

ipcMain.handle('toggle-mode', async (event, height, width) => {
    if (!mainWindow) return false

    const currentMode = mainWindow.isAlwaysOnTop()
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    
    if (currentMode) {
        // Switch back to default mode
        mainWindow.setAlwaysOnTop(false)
        mainWindow.setMaximumSize(2147483647, 2147483647) // Reset max size first
        mainWindow.setMinimumSize(defaultConfig.width, defaultConfig.height)
        mainWindow.setSize(defaultConfig.width, defaultConfig.height, true) // true forces immediate resize
        mainWindow.setAutoHideMenuBar(false)
        mainWindow.setMenuBarVisibility(true)
        
        // Center the window
        const x = Math.floor((screenWidth - defaultConfig.width) / 2)
        const y = Math.floor((screenHeight - defaultConfig.height) / 2)
        mainWindow.setPosition(x, y, true)
    } else {
        // Switch to custom mode
        mainWindow.setAlwaysOnTop(true, 'screen-saver')
        mainWindow.setMinimumSize(width, height)
        mainWindow.setMaximumSize(width, height)
        mainWindow.setSize(width, height, true) // true forces immediate resize
        mainWindow.setAutoHideMenuBar(true)
        mainWindow.setMenuBarVisibility(false)
        
        // Position in lower right corner with 20px padding
        const x = screenWidth - width
        const y = screenHeight - height
        mainWindow.setPosition(x, y, true)
    }
    
    return !currentMode
})

ipcMain.handle('get-mode', async (event) => {
  if(!mainWindow) return false
  return mainWindow.isAlwaysOnTop()
})