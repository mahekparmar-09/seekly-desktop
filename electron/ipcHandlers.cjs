const { ipcMain, dialog, app } = require('electron');
const { getDatabase, fileDao } = require('./database.cjs');
const { initSearchPool, searchInWorker, terminateWorker } = require('./searchPool.cjs');
const { getIndexer } = require('./indexer.cjs');
const { getDocumentIndexer } = require('./documentIndexer.cjs');
const { getFileWatcher } = require('./fileWatcher.cjs');
const { openFile, openFileLocation } = require('./fileOpener.cjs');
const {
  recordSearch,
  getRecentSearches,
  deleteRecentSearch,
  clearRecentSearches
} = require('./history.cjs');
const { toggleFavorite, getFavorites } = require('./favorites.cjs');
const {
  getExcludedFolders,
  addExcludedFolder,
  removeExcludedFolder
} = require('./privacy.cjs');

// Terminate worker pool gracefully on quit
app.on('before-quit', () => {
  terminateWorker();
});

let handlersInitialized = false;
let currentMainWindow = null;

/**
 * Setup validated IPC handlers for renderer communication
 * @param {import('electron').BrowserWindow} mainWindow
 */
function setupIpcHandlers(mainWindow) {
  currentMainWindow = mainWindow;
  if (handlersInitialized) {
    return;
  }
  handlersInitialized = true;

  const db = getDatabase();
  const indexer = getIndexer(db);
  const docIndexer = getDocumentIndexer(db);
  const fileWatcher = getFileWatcher(db);

  // Initialize the search worker pool with the real database path
  // (must happen after getDatabase() so the DB file exists)
  initSearchPool(db.name);

  // Wire progress event forwarding to renderer
  const broadcastProgress = (data) => {
    if (currentMainWindow && !currentMainWindow.isDestroyed()) {
      currentMainWindow.webContents.send('indexer:update', data);
    }
  };

  indexer.setUpdateCallback(broadcastProgress);
  docIndexer.setUpdateCallback(broadcastProgress);

  // Start background indexing and filesystem watching on launch
  setTimeout(() => {
    indexer.startIndexing().then(() => {
      // Delay document content extraction so startup and initial searches are instantaneous
      setTimeout(() => {
        docIndexer.processPendingDocuments().catch(console.error);
      }, 3000);
      fileWatcher.start();
    }).catch(console.error);
  }, 1500);

  // Folder picker dialog
  ipcMain.handle('dialog:selectFolder', async () => {
    if (!currentMainWindow || currentMainWindow.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(currentMainWindow, {
      properties: ['openDirectory'],
      title: 'Select Folder to Exclude from Seekly Index'
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  let historyDebounceTimer = null;

  // Search — query is executed in the worker thread (never blocks main process)
  ipcMain.handle('search:query', async (_event, params) => {
    const query = params?.query || '';
    const options = {
      mode: params?.mode || 'both',
      category: params?.category || 'all',
      fileType: params?.fileType || 'all',
      dateRange: params?.dateRange || 'any',
      sizeRange: params?.sizeRange || 'any',
      location: params?.location || 'all',
      sortBy: params?.sortBy || 'relevance',
      limit: params?.limit || 30,
      offset: params?.offset || 0
    };

    // Run query in worker thread — never blocks main process / UI
    const res = await searchInWorker(query, options);

    // Debounce recording in search history (800ms) to prevent SQLite lock contention
    if (query && query.trim().length >= 2) {
      if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
      historyDebounceTimer = setTimeout(() => {
        try {
          recordSearch(query.trim(), options.mode, options, db);
        } catch (_e) {}
      }, 800);
    }

    return res;
  });

  // History
  ipcMain.handle('history:record', async (_event, data) => {
    if (data?.query && data.query.trim().length >= 2) {
      return recordSearch(data.query.trim(), data.mode || 'both', data.filterData || null, db);
    }
    return null;
  });

  ipcMain.handle('history:get', async () => {
    return getRecentSearches(20, db);
  });

  ipcMain.handle('history:delete', async (_event, id) => {
    return deleteRecentSearch(Number(id), db);
  });

  ipcMain.handle('history:clear', async () => {
    return clearRecentSearches(db);
  });

  // Favorites
  ipcMain.handle('favorites:get', async () => {
    return getFavorites(db);
  });

  ipcMain.handle('favorites:toggle', async (_event, fileId) => {
    return toggleFavorite(Number(fileId), db);
  });

  // File operations
  ipcMain.handle('file:open', async (_event, filePath) => {
    return openFile(filePath);
  });

  ipcMain.handle('file:openLocation', async (_event, filePath) => {
    return openFileLocation(filePath);
  });

  // Indexing status and controls
  ipcMain.handle('indexer:status', async () => {
    const stats = fileDao.getStats(db);
    return {
      ...stats,
      status: indexer.isIndexing ? 'Indexing files...' : (docIndexer.isProcessing ? 'Extracting document text...' : 'Ready'),
      isPaused: indexer.isPaused || docIndexer.isPaused,
      progress: (indexer.isIndexing || docIndexer.isProcessing) ? -1 : 100
    };
  });

  ipcMain.handle('indexer:pause', async () => {
    indexer.pause();
    docIndexer.pause();
    return true;
  });

  ipcMain.handle('indexer:resume', async () => {
    indexer.resume();
    docIndexer.resume();
    return true;
  });

  ipcMain.handle('indexer:rebuild', async () => {
    indexer.rebuild().then(() => {
      docIndexer.processPendingDocuments();
    }).catch(console.error);
    return true;
  });

  // Privacy / Excluded folders
  ipcMain.handle('privacy:getExclusions', async () => {
    return getExcludedFolders(db);
  });

  ipcMain.handle('privacy:addExclusion', async (_event, folderPath) => {
    return addExcludedFolder(folderPath, db);
  });

  ipcMain.handle('privacy:removeExclusion', async (_event, folderPath) => {
    return removeExcludedFolder(folderPath, db);
  });
}

module.exports = {
  setupIpcHandlers
};
