const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Check if running in development (no need for electron-is-dev)
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Only require electron-serve in production
let loadURL
if (!isDev) {
  try {
    const serve = require('electron-serve')
    loadURL = serve({ directory: 'out' })
  } catch (err) {
    console.error('Failed to load electron-serve:', err)
  }
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    // Development: load from Next.js dev server
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load from built files
    if (loadURL) {
      loadURL(mainWindow)
    } else {
      // Fallback: load from Next.js standalone output
      // Note: This requires Next.js to be built with output: 'standalone'
      // For now, we'll need to run Next.js server or use static export
      console.error('electron-serve not available. Next.js must run as server or use static export.')
      mainWindow.loadURL('http://localhost:3000')
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handler for silent printing
ipcMain.handle('print-receipt', async (event, htmlContent) => {
  return new Promise((resolve, reject) => {
    if (!mainWindow) {
      reject(new Error('Main window not available'))
      return
    }

    // Create a hidden window for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: '', // Use default printer
        },
        (success, failureReason) => {
          printWindow.close()
          if (success) {
            resolve({ success: true })
          } else {
            reject(new Error(failureReason || 'Print failed'))
          }
        }
      )
    })

    printWindow.webContents.on('did-fail-load', () => {
      printWindow.close()
      reject(new Error('Failed to load print content'))
    })
  })
})

