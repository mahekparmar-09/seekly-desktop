const { ipcMain, dialog } = require('electron');
const { getDatabase, fileDao } = require('./database.cjs');
const { search } = require('./search.cjs');
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

/**
 * Setup validated IPC handlers for renderer communication
 * @param {import('electron').BrowserWindow} mainWindow
 */
function setupIpcHandlers(mainWindow) {
  const db = getDatabase();
  const indexer = getIndexer(db);
  const docIndexer = getDocumentIndexer(db);
  const fileWatcher = getFileWatcher(db);

  // Wire progress event forwarding to renderer
  const broadcastProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('indexer:update', data);
    }
  };

  indexer.setUpdateCallback(broadcastProgress);
  docIndexer.setUpdateCallback(broadcastProgress);

  // Start background indexing and filesystem watching on launch
  setTimeout(() => {
    indexer.startIndexing().then(() => {
      docIndexer.processPendingDocuments();
      fileWatcher.start();
    }).catch(console.error);
  }, 1000);

  // Folder picker dialog
  ipcMain.handle('dialog:selectFolder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Folder to Exclude from Seekly Index'
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Search
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

    const res = search(query, options, db);

    // Record in search history if non-empty query
    if (query && query.length >= 2) {
      recordSearch(query, options.mode, options, db);
    }

    return res;
  });

  // History
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
