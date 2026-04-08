// electron/main.js — Quillon Desktop Entry Point
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow = null
let serverProcess = null
const SERVER_PORT = 3941  // unique port to avoid conflicts

// ── Start the Express server as a child process ───────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server-wrapper.cjs')

    serverProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        QUILLON_PORT: SERVER_PORT,
        QUILLON_DATA: path.join(app.getPath('userData'), 'projects'),
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    serverProcess.stdout.on('data', d => {
      const msg = d.toString()
      console.log('[server]', msg.trim())
      if (msg.includes('running at')) resolve()
    })

    serverProcess.stderr.on('data', d => console.error('[server err]', d.toString().trim()))
    serverProcess.on('error', reject)

    // Fallback — wait 3s and try anyway
    setTimeout(resolve, 3000)
  })
}

// ── Poll until server is ready ────────────────────────────────────────────
function waitForServer(retries = 20) {
  return new Promise((resolve, reject) => {
    const tryConnect = (n) => {
      http.get(`http://localhost:${SERVER_PORT}/api/health`, res => {
        if (res.statusCode === 200) resolve()
        else if (n > 0) setTimeout(() => tryConnect(n-1), 300)
        else reject(new Error('Server did not start'))
      }).on('error', () => {
        if (n > 0) setTimeout(() => tryConnect(n-1), 300)
        else reject(new Error('Server did not start'))
      })
    }
    tryConnect(retries)
  })
}

// ── Create the main window ────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Quillon',
    icon: path.join(__dirname, '../build/icon.ico'),
    backgroundColor: '#0e0f11',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    // Clean frameless feel
    frame: true,
    titleBarStyle: 'default',
    show: false  // show after load to avoid white flash
  })

  // Show splash while server starts, then load the app
  mainWindow.loadFile(path.join(__dirname, 'splash.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Open external links in browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow()

  try {
    await startServer()
    await waitForServer()
    // Navigate from splash to the actual app
    if (mainWindow) {
      mainWindow.loadURL(`http://localhost:${SERVER_PORT}/app`)
    }
  } catch (e) {
    console.error('Failed to start server:', e)
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'error.html'))
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill()
})
