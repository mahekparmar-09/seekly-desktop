const fs = require('fs');
const path = require('path');
const os = require('os');
const { fileDao, getDatabase } = require('./database.cjs');

// Category mapping based on file extension
const EXTENSION_CATEGORIES = {
  // Documents
  '.pdf': 'documents',
  '.docx': 'documents',
  '.doc': 'documents',
  '.txt': 'documents',
  '.rtf': 'documents',
  '.odt': 'documents',
  '.xlsx': 'documents',
  '.xls': 'documents',
  '.csv': 'documents',
  '.pptx': 'documents',
  '.ppt': 'documents',

  // Images
  '.jpg': 'images',
  '.jpeg': 'images',
  '.png': 'images',
  '.gif': 'images',
  '.bmp': 'images',
  '.webp': 'images',
  '.svg': 'images',
  '.ico': 'images',

  // Videos
  '.mp4': 'videos',
  '.mkv': 'videos',
  '.avi': 'videos',
  '.mov': 'videos',
  '.wmv': 'videos',
  '.flv': 'videos',
  '.webm': 'videos',

  // Audio
  '.mp3': 'audio',
  '.wav': 'audio',
  '.flac': 'audio',
  '.aac': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',

  // Applications
  '.exe': 'applications',
  '.lnk': 'applications',
  '.bat': 'applications',
  '.cmd': 'applications',
  '.msi': 'applications'
};

const CONTENT_INDEXABLE_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

class Indexer {
  constructor(db = null) {
    this.db = db;
    this.isIndexing = false;
    this.isPaused = false;
    this.onUpdateCallback = null;
    this.cancelRequested = false;
  }

  getDb() {
    return this.db || getDatabase();
  }

  setUpdateCallback(cb) {
    this.onUpdateCallback = cb;
  }

  emitUpdate(customStatus = {}) {
    if (this.onUpdateCallback) {
      const db = this.getDb();
      const stats = fileDao.getStats(db);
      this.onUpdateCallback({
        ...stats,
        isPaused: this.isPaused,
        ...customStatus
      });
    }
  }

  /**
   * Determine default locations to index on Windows
   */
  getDefaultLocations() {
    const locations = [];
    const home = os.homedir();

    const desktop = path.join(home, 'Desktop');
    const documents = path.join(home, 'Documents');
    const downloads = path.join(home, 'Downloads');

    if (fs.existsSync(desktop)) locations.push({ path: desktop, type: 'folder' });
    if (fs.existsSync(documents)) locations.push({ path: documents, type: 'folder' });
    if (fs.existsSync(downloads)) locations.push({ path: downloads, type: 'folder' });

    // Windows Start Menu locations
    const appData = process.env.APPDATA;
    if (appData) {
      const userStartMenu = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      if (fs.existsSync(userStartMenu)) locations.push({ path: userStartMenu, type: 'apps' });
    }

    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const commonStartMenu = path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    if (fs.existsSync(commonStartMenu)) locations.push({ path: commonStartMenu, type: 'apps' });

    return locations;
  }

  /**
   * Categorize file
   */
  categorize(ext, isDir, isApp) {
    if (isApp) return 'applications';
    if (isDir) return 'folders';
    return EXTENSION_CATEGORIES[ext.toLowerCase()] || 'other';
  }

  /**
   * Check if a path is excluded by privacy rules
   */
  isPathExcluded(targetPath, excludedList = []) {
    const normalized = path.normalize(targetPath).toLowerCase();
    for (const excl of excludedList) {
      const normExcl = path.normalize(excl).toLowerCase();
      if (normalized === normExcl || normalized.startsWith(normExcl + path.sep)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scan a directory recursively and return items
   */
  async scanDirectory(dirPath, isAppLocation = false, excludedList = [], maxDepth = 10, currentDepth = 0) {
    if (currentDepth > maxDepth || this.cancelRequested) return [];
    if (this.isPathExcluded(dirPath, excludedList)) return [];

    let entries = [];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (_err) {
      // Access denied or unreadable directory
      return [];
    }

    const results = [];

    for (const entry of entries) {
      if (this.cancelRequested) break;

      // Handle pause
      while (this.isPaused && !this.cancelRequested) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const fullPath = path.join(dirPath, entry.name);
      if (this.isPathExcluded(fullPath, excludedList)) continue;

      try {
        if (entry.isSymbolicLink()) {
          // Safeguard: do not traverse symlinks in V1 to avoid recursive loops
          continue;
        }

        if (entry.isDirectory()) {
          // Index the folder itself
          results.push({
            name: entry.name,
            path: fullPath,
            type: 'folder',
            extension: '',
            category: 'folders',
            size: 0,
            created_at: 0,
            modified_at: 0,
            indexed_at: Date.now(),
            content_status: 'skipped',
            content_fingerprint: null
          });

          // Recurse into child directory
          const children = await this.scanDirectory(fullPath, isAppLocation, excludedList, maxDepth, currentDepth + 1);
          results.push(...children);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const isLnk = ext === '.lnk';
          const isApp = isAppLocation && (isLnk || ext === '.exe');
          
          let displayName = entry.name;
          if (isLnk) {
            // Strip .lnk for clean app display name
            displayName = path.basename(entry.name, '.lnk');
          }

          let stats = null;
          try {
            stats = await fs.promises.stat(fullPath);
          } catch (_e) {
            continue;
          }

          const isContentIndexable = CONTENT_INDEXABLE_EXTENSIONS.has(ext);

          results.push({
            name: displayName,
            path: fullPath,
            type: isApp ? 'app' : 'file',
            extension: ext,
            category: this.categorize(ext, false, isApp),
            size: stats.size,
            created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs),
            modified_at: Math.floor(stats.mtimeMs),
            indexed_at: Date.now(),
            content_status: isContentIndexable ? 'pending' : 'skipped',
            content_fingerprint: null
          });
        }
      } catch (_e) {
        // Individual entry failed (e.g. file lock or permissions)
      }
    }

    return results;
  }

  /**
   * Main indexing orchestrator
   */
  async startIndexing(options = {}) {
    if (this.isIndexing) return;

    this.isIndexing = true;
    this.isPaused = false;
    this.cancelRequested = false;

    const db = this.getDb();

    try {
      this.emitUpdate({ status: 'Preparing search index...', progress: -1 });

      // Fetch excluded folders
      const excludedRows = db.prepare('SELECT folder_path FROM excluded_folders').all();
      const excludedList = excludedRows.map((r) => r.folder_path);

      const locations = options.locations || this.getDefaultLocations();
      this.emitUpdate({ status: 'Indexing files...', progress: -1 });

      let scannedCount = 0;

      for (const loc of locations) {
        if (this.cancelRequested) break;

        const isApp = loc.type === 'apps';
        const items = await this.scanDirectory(loc.path, isApp, excludedList);

        // Batch insert into database in chunks of 100 for optimal performance and no UI freeze
        const chunkSize = 100;
        for (let i = 0; i < items.length; i += chunkSize) {
          if (this.cancelRequested) break;

          while (this.isPaused && !this.cancelRequested) {
            await new Promise((r) => setTimeout(r, 200));
          }

          const chunk = items.slice(i, i + chunkSize);
          const trans = db.transaction(() => {
            for (const item of chunk) {
              fileDao.upsertFile(db, item);
            }
          });
          trans();

          scannedCount += chunk.length;
          this.emitUpdate({
            status: `Indexing files (${scannedCount.toLocaleString()})...`,
            progress: -1
          });

          // Yield to event loop
          await new Promise((r) => setImmediate(r));
        }
      }

      this.emitUpdate({ status: 'Ready', progress: 100 });
    } catch (err) {
      console.error('[Indexer] Error during indexing:', err);
      this.emitUpdate({ status: 'Indexing encountered an issue', progress: 100 });
    } finally {
      this.isIndexing = false;
    }
  }

  pause() {
    this.isPaused = true;
    this.emitUpdate({ status: 'Indexing paused', isPaused: true });
  }

  resume() {
    this.isPaused = false;
    this.emitUpdate({ status: 'Resuming indexing...', isPaused: false });
  }

  async rebuild() {
    this.cancelRequested = true;
    this.isPaused = false;

    // Small delay to allow any loop to finish
    await new Promise((r) => setTimeout(r, 150));

    const db = this.getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM document_content_fts').run();
      db.prepare('DELETE FROM document_content').run();
      db.prepare('DELETE FROM files').run();
    })();

    this.cancelRequested = false;
    await this.startIndexing();
  }
}

let indexerInstance = null;
function getIndexer(db = null) {
  if (!indexerInstance) {
    indexerInstance = new Indexer(db);
  }
  return indexerInstance;
}

module.exports = {
  Indexer,
  getIndexer,
  EXTENSION_CATEGORIES,
  CONTENT_INDEXABLE_EXTENSIONS
};
