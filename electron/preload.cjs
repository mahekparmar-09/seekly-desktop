const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, tightly scoped APIs to the renderer
contextBridge.exposeInMainWorld('seeklyAPI', {
  // Search
  searchFiles: (params) => ipcRenderer.invoke('search:query', params),
  
  // History
  getRecentSearches: () => ipcRenderer.invoke('history:get'),
  deleteRecentSearch: (id) => ipcRenderer.invoke('history:delete', id),
  clearRecentSearches: () => ipcRenderer.invoke('history:clear'),
  
  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (fileId) => ipcRenderer.invoke('favorites:toggle', fileId),
  
  // File operations
  openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
  openFileLocation: (filePath) => ipcRenderer.invoke('file:openLocation', filePath),
  
  // Indexing status and controls
  getIndexingStatus: () => ipcRenderer.invoke('indexer:status'),
  pauseIndexing: () => ipcRenderer.invoke('indexer:pause'),
  resumeIndexing: () => ipcRenderer.invoke('indexer:resume'),
  rebuildIndex: () => ipcRenderer.invoke('indexer:rebuild'),
  
  // Privacy / Excluded folders
  getExcludedFolders: () => ipcRenderer.invoke('privacy:getExclusions'),
  addExcludedFolder: (folderPath) => ipcRenderer.invoke('privacy:addExclusion', folderPath),
  removeExcludedFolder: (folderPath) => ipcRenderer.invoke('privacy:removeExclusion', folderPath),
  selectFolderDialog: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // Window controls
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  
  // Event subscriptions
  onIndexingUpdate: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('indexer:update', subscription);
    return () => ipcRenderer.removeListener('indexer:update', subscription);
  },
  onWindowShown: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('window:shown', subscription);
    return () => ipcRenderer.removeListener('window:shown', subscription);
  }
});
