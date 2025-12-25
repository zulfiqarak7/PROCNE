const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow () {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "Sands of Time: Echoes",
    backgroundColor: '#2E4583',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // In production, load the build file. In dev, you might load localhost.
  // We assume we are building for distribution here.
  win.loadFile(path.join(__dirname, 'dist', 'index.html'))
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