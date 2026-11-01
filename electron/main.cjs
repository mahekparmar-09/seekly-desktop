const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createSearchWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 480,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    show: false,
    center: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  // Load URL depending on dev/prod environment
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Gracefully show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize modular IPC handlers
  try {
    const { setupIpcHandlers } = require('./ipcHandlers.cjs');
    setupIpcHandlers(mainWindow);
  } catch (err) {
    console.warn('IPC handlers initialization deferred or warning:', err.message);
  }
}

function toggleWindow() {
  if (!mainWindow) {
    createSearchWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('window:shown');
  }
}

app.whenReady().then(() => {
  createSearchWindow();

  // Register Ctrl+Space global shortcut
  const shortcut = 'CommandOrControl+Space';
  const registered = globalShortcut.register(shortcut, () => {
    toggleWindow();
  });

  if (!registered) {
    console.warn(`[Seekly] Failed to register global shortcut: ${shortcut}. It may be in use by another application.`);
  } else {
    console.log(`[Seekly] Global shortcut ${shortcut} registered successfully.`);
  }

  // Window show / hide IPC handlers for escape key and minimize
  ipcMain.handle('window:hide', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
    return true;
  });

  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
    return true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSearchWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
