const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Enforce single instance so multiple apps don't collide or lock the global shortcut
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createSearchWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  // Force Windows to bring the window to the foreground and focus it
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(false);

  if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('window:shown');
  }
}

function hideWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createSearchWindow();
    return;
  }

  // If window is minimized or not visible: show and focus it
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    showWindow();
  } else {
    // If window is already visible:
    // If it has active focus, hide it (user wants to dismiss)
    // If it does NOT have focus (user is working in another app), bring to front and focus it
    if (mainWindow.isFocused()) {
      hideWindow();
    } else {
      showWindow();
    }
  }
}

function createSearchWindow() {
  const iconPath = path.join(__dirname, '../assets/branding/seekly-icon.ico');

  mainWindow = new BrowserWindow({
    width: 980,
    height: 640,
    minWidth: 780,
    minHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#18191D',
    icon: iconPath,
    alwaysOnTop: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    show: false,
    center: true,
    hasShadow: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  // Load built dist if available, or dev server if configured
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const distIndexPath = path.join(__dirname, '../dist/index.html');

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else if (fs.existsSync(distIndexPath)) {
    mainWindow.loadFile(distIndexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // Gracefully show when ready
  mainWindow.once('ready-to-show', () => {
    showWindow();
  });

  // Notify renderer of maximize/unmaximize
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('window:maximized', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('window:maximized', false);
    }
  });

  // Intercept close: hide instead of destroy so Ctrl+Space can bring it back
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hideWindow();
    }
  });

  // Only nullify after real destruction (app quit)
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

app.on('second-instance', () => {
  // If user tries to launch a second instance, bring our window to front
  showWindow();
});

app.whenReady().then(() => {
  createSearchWindow();

  // Register Ctrl+Space and Alt+Space global shortcuts
  const shortcuts = ['CommandOrControl+Space', 'Alt+Space'];
  shortcuts.forEach((sc) => {
    try {
      const registered = globalShortcut.register(sc, () => {
        toggleWindow();
      });
      if (registered) {
        console.log(`[Seekly] Global shortcut ${sc} registered successfully.`);
      } else {
        console.warn(`[Seekly] Failed to register ${sc} (may be in use by OS or another app).`);
      }
    } catch (err) {
      console.warn(`[Seekly] Error registering ${sc}:`, err.message);
    }
  });

  // Window control IPC handlers
  ipcMain.handle('window:hide', () => {
    hideWindow();
    return true;
  });

  ipcMain.handle('window:show', () => {
    showWindow();
    return true;
  });

  ipcMain.handle('window:toggle', () => {
    toggleWindow();
    return true;
  });

  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
    return true;
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return mainWindow.isMaximized();
    }
    return false;
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSearchWindow();
    } else {
      showWindow();
    }
  });
});

// Set quit flag so the 'close' interceptor lets the window actually close
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Do NOT quit when window is closed — keep app alive so Ctrl+Space works anytime
app.on('window-all-closed', () => {
  // Intentionally blank: app stays running in background
});
