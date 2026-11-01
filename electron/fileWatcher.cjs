const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const { fileDao, getDatabase } = require('./database.cjs');
const { getIndexer, CONTENT_INDEXABLE_EXTENSIONS } = require('./indexer.cjs');
const { getDocumentIndexer } = require('./documentIndexer.cjs');

class FileWatcher {
  constructor(db = null) {
    this.db = db;
    this.watcher = null;
    this.debounceTimers = new Map();
    this.isWatching = false;
  }

  getDb() {
    return this.db || getDatabase();
  }

  /**
   * Start watching locations
   * @param {string[]} pathsToWatch
   */
  start(pathsToWatch = []) {
    if (this.isWatching) return;
    const db = this.getDb();

    // Default locations if none passed
    const targets = pathsToWatch.length > 0 
      ? pathsToWatch 
      : getIndexer(db).getDefaultLocations().map(l => l.path);

    const validTargets = targets.filter(p => fs.existsSync(p));
    if (validTargets.length === 0) return;

    this.watcher = chokidar.watch(validTargets, {
      ignored: /(^|[\/\\])\..|node_modules|\.git/, // Ignore hidden files and dot folders
      persistent: true,
      ignoreInitial: true, // Initial scan is handled by Indexer
      depth: 6,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath) => this.queueEvent('add', filePath))
      .on('change', (filePath) => this.queueEvent('change', filePath))
      .on('unlink', (filePath) => this.queueEvent('unlink', filePath))
      .on('unlinkDir', (dirPath) => this.queueEvent('unlinkDir', dirPath))
      .on('error', (err) => console.warn('[FileWatcher] Watch error:', err.message));

    this.isWatching = true;
  }

  /**
   * Queue and debounce file events
   */
  queueEvent(type, targetPath) {
    if (this.debounceTimers.has(targetPath)) {
      clearTimeout(this.debounceTimers.get(targetPath));
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(targetPath);
      this.handleEvent(type, targetPath).catch(err => {
        console.warn(`[FileWatcher] Error handling ${type} for ${targetPath}:`, err.message);
      });
    }, 400);

    this.debounceTimers.set(targetPath, timer);
  }

  /**
   * Process debounced file event
   */
  async handleEvent(type, targetPath) {
    const db = this.getDb();
    const indexer = getIndexer(db);

    // Check privacy exclusions
    const excludedRows = db.prepare('SELECT folder_path FROM excluded_folders').all();
    const excludedList = excludedRows.map(r => r.folder_path);
    if (indexer.isPathExcluded(targetPath, excludedList)) {
      return;
    }

    if (type === 'unlink' || type === 'unlinkDir') {
      fileDao.deleteFileByPath(db, targetPath);
      return;
    }

    if (type === 'add' || type === 'change') {
      if (!fs.existsSync(targetPath)) return;

      try {
        const stats = await fs.promises.stat(targetPath);
        const isDir = stats.isDirectory();
        const ext = path.extname(targetPath).toLowerCase();
        const isLnk = ext === '.lnk';
        const isApp = isLnk || ext === '.exe';

        let displayName = path.basename(targetPath);
        if (isLnk) displayName = path.basename(targetPath, '.lnk');

        const isContentIndexable = CONTENT_INDEXABLE_EXTENSIONS.has(ext);

        fileDao.upsertFile(db, {
          name: displayName,
          path: targetPath,
          type: isDir ? 'folder' : (isApp ? 'app' : 'file'),
          extension: isDir ? '' : ext,
          category: indexer.categorize(ext, isDir, isApp),
          size: stats.size,
          created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs),
          modified_at: Math.floor(stats.mtimeMs),
          indexed_at: Date.now(),
          content_status: isContentIndexable ? 'pending' : 'skipped',
          content_fingerprint: null
        });

        // Trigger background content extraction if document
        if (isContentIndexable) {
          getDocumentIndexer(db).processPendingDocuments().catch(console.error);
        }
      } catch (_e) {}
    }
  }

  /**
   * Stop watching and cleanup
   */
  async stop() {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
  }
}

let watcherInstance = null;
function getFileWatcher(db = null) {
  if (!watcherInstance) {
    watcherInstance = new FileWatcher(db);
  }
  return watcherInstance;
}

module.exports = {
  FileWatcher,
  getFileWatcher
};
