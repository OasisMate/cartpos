const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Development = local Next dev server; Production = the live deployed site.
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// The packaged desktop app is a thin shell over the live CartPOS site. This keeps
// a real server behind it (API routes + DB) - a static export can't run those - and
// the silent-print IPC handler below makes receipts print with no dialog.
// Override the domain at build/run time with CARTPOS_DESKTOP_URL.
const PROD_URL = process.env.CARTPOS_DESKTOP_URL || 'https://cartpos.vercel.app'

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
    // Development: load from the local Next.js dev server
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load the live deployed CartPOS site
    mainWindow.loadURL(PROD_URL)
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

