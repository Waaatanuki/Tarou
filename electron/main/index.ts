import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import process from 'node:process'
import { BrowserWindow, WebContentsView, app, ipcMain, session, shell } from 'electron'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1'))
  app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32')
  app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    width: 1400,
    height: 900,
    webPreferences: {
      webviewTag: true,
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  }
  else {
    win.loadFile(indexHtml)
  }

  const view = new WebContentsView()
  win.contentView.addChildView(view)
  view.webContents.loadURL('https://game.granbluefantasy.jp/')
  view.setBounds({ x: 0, y: 0, width: 1200, height: 840 })

  try {
    view.webContents.debugger.attach('1.1')
  }
  catch (err) {
    console.log('Debugger attach failed : ', err)
  }

  view.webContents.debugger.on('detach', (event, reason) => {
    console.log('Debugger detached due to : ', reason)
  })

  // view.webContents.debugger.on('message', (event, method, params) => {
  //   if (method === 'Network.responseReceived')
  //     console.log(params.response.url)

  //   view.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: params.requestId }).then((response) => {
  //     win.webContents.send('resp', response)
  //   })
  // })

  view.webContents.debugger.sendCommand('Network.enable')

  view.webContents.on('did-finish-load', () => {
    console.log(31)

    view.webContents.openDevTools()

    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      console.log(333)

      callback(true)
    })
  })

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    console.log(win.webContents.getUserAgent())
    win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.233 Safari/537.36')
    console.log(win.webContents.getUserAgent())
    win.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('main-process-message', new Date().toLocaleString())
  })
  win.on('resized', (arg) => {
    console.log('resize', JSON.stringify(arg))
    const winBounds = win.getBounds()
    console.log(win.getBounds())
    view.setBounds({ x: 0, y: 0, width: 1200, height: winBounds.height - 60 })
    win.webContents.send('resized', view.getBounds())
    console.log(view.webContents.getUserAgent())
    console.log(view.webContents.mainFrame)
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      console.log(url)
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin')
    app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized())
      win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  }
  else {
    createWindow()
  }
})

app.on('browser-window-created', (event, window) => {
  window.webContents.on('did-finish-load', () => {
    console.log(window.webContents.getURL())
  })
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  }
  else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
