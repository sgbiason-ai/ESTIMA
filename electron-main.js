const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#040a0e', // Couleur de fond de votre App
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Gestion du chemin selon si on est en développement ou en production
  if (app.isPackaged) {
    // En production : on charge le fichier compilé dans le dossier dist
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  } else {
    // En développement : on charge l'URL de Vite
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});