const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'public/favicon.ico'), // Optionnel
    webPreferences: {
      nodeIntegration: true,     // conservé comme chez toi
      contextIsolation: false,  // évite des bugs avec Vite / preload
    },
  });

  // En développement, on charge l'URL de Vite
  // En production, on charge le index.html buildé
  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools(); // pratique en dev
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
