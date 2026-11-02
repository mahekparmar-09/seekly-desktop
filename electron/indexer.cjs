const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const { exec } = require('child_process');
const execAsync = util.promisify(exec);
const { fileDao, getDatabase } = require('./database.cjs');

// Category mapping based on file extension
const EXTENSION_CATEGORIES = {
  // Documents
  '.pdf': 'documents',
  '.docx': 'documents',
  '.doc': 'documents',
  '.txt': 'documents',
  '.md': 'documents',
  '.markdown': 'documents',
  '.rtf': 'documents',
  '.odt': 'documents',
  '.xlsx': 'documents',
  '.xls': 'documents',
  '.csv': 'documents',
  '.json': 'documents',
  '.log': 'documents',
  '.html': 'documents',
  '.htm': 'documents',
  '.xml': 'documents',
  '.yaml': 'documents',
  '.yml': 'documents',
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

// Ignored directories to prevent indexing build outputs, dependencies, and circular system folders
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.cache',
  'appdata',
  '$recycle.bin',
  'system volume information',
  '.idea',
  '.vscode',
  '.next',
  '.nuxt',
  'build',
  'dist',
  'out',
  'target',
  'bin',
  'obj',
  'venv',
  '.env',
  'vendor',
  '__pycache__',
  '.gradle',
  '.m2'
]);

const CONTENT_INDEXABLE_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.log',
  '.rtf',
  '.html',
  '.htm',
  '.xml',
  '.yaml',
  '.yml',
  '.ini',
  '.env',
  '.sql'
]);

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
    const seen = new Set();

    const addLocation = (locPath, type = 'folder') => {
      if (!locPath) return;
      try {
        const normalized = path.normalize(locPath);
        const lower = normalized.toLowerCase();
        if (!seen.has(lower) && fs.existsSync(normalized)) {
          seen.add(lower);
          locations.push({ path: normalized, type });
        }
      } catch (_e) { }
    };

    const home = os.homedir();
    const oneDrive = process.env.OneDrive || process.env.OneDriveConsumer || (fs.existsSync(path.join(home, 'OneDrive')) ? path.join(home, 'OneDrive') : null);

    // 1. Desktops (both OneDrive and standard user profile)
    if (oneDrive) addLocation(path.join(oneDrive, 'Desktop'), 'folder');
    addLocation(path.join(home, 'Desktop'), 'folder');

    // 2. Documents (both OneDrive and standard)
    if (oneDrive) addLocation(path.join(oneDrive, 'Documents'), 'folder');
    addLocation(path.join(home, 'Documents'), 'folder');

    // 3. Downloads
    addLocation(path.join(home, 'Downloads'), 'folder');

    // 4. Pictures (both OneDrive and standard)
    if (oneDrive) addLocation(path.join(oneDrive, 'Pictures'), 'folder');
    addLocation(path.join(home, 'Pictures'), 'folder');

    // 5. Videos and Music
    addLocation(path.join(home, 'Videos'), 'folder');
    addLocation(path.join(home, 'Music'), 'folder');

    // 6. Developer & Project roots if present
    addLocation('C:\\Projects', 'folder');
    addLocation(path.join(home, 'Projects'), 'folder');
    addLocation(path.join(home, 'source'), 'folder');
    addLocation(path.join(home, 'repos'), 'folder');

    // 7. Windows Start Menu locations (shortcut-based apps)
    const appData = process.env.APPDATA;
    if (appData) {
      addLocation(path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 'apps');
    }

    const programData = process.env.ProgramData || 'C:\\ProgramData';
    addLocation(path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 'apps');

    // 8. Program Files — shallow scan (depth 2) for .exe files
    addLocation('C:\\Program Files', 'apps-shallow');
    addLocation('C:\\Program Files (x86)', 'apps-shallow');

    return locations;
  }

  /**
   * Collect installed apps from Windows Registry and Windows Store (UWP).
   * Returns an array of file-record objects ready for DB upsert.
   */
  async scanInstalledApps() {
    const apps = new Map(); // path.toLowerCase() -> record, dedup by path

    // ── Registry: traditional Win32 apps (asynchronous, non-blocking) ─────
    const regKeys = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ];

    for (const regKey of regKeys) {
      if (this.cancelRequested) break;
      try {
        let nameRaw = '';
        let iconRaw = '';

        try {
          const res = await execAsync(`reg query "${regKey}" /s /v DisplayName 2>nul`, {
            encoding: 'utf8', timeout: 4000, windowsHide: true, maxBuffer: 10 * 1024 * 1024
          });
          nameRaw = res.stdout || '';
        } catch (_e) { }

        try {
          const res = await execAsync(`reg query "${regKey}" /s /v DisplayIcon 2>nul`, {
            encoding: 'utf8', timeout: 4000, windowsHide: true, maxBuffer: 10 * 1024 * 1024
          });
          iconRaw = res.stdout || '';
        } catch (_e) { }

        await new Promise((r) => setImmediate(r));

        // Build subkey -> displayName map
        const nameMap = new Map();
        let curKey = '';
        for (const line of nameRaw.split('\r\n')) {
          const t = line.trim();
          if (t.startsWith('HKEY_')) { curKey = t; }
          else if (t.startsWith('DisplayName') && curKey) {
            const m = t.match(/REG_SZ\s+(.+)$/);
            if (m) nameMap.set(curKey, m[1].trim());
          }
        }

        // Parse icon (exe) paths
        curKey = '';
        for (const line of iconRaw.split('\r\n')) {
          const t = line.trim();
          if (t.startsWith('HKEY_')) { curKey = t; }
          else if (t.startsWith('DisplayIcon') && curKey && nameMap.has(curKey)) {
            const m = t.match(/REG_SZ\s+(.+)$/);
            if (!m) continue;
            let exePath = m[1].trim().replace(/,\s*\d+\s*$/, '').replace(/^"|"$/g, '').trim();
            if (!exePath.toLowerCase().endsWith('.exe')) continue;
            if (/windows\\system32|syswow64|winsxs|dotnet\\shared/i.test(exePath)) continue;
            try {
              if (fs.existsSync(exePath)) {
                const stats = fs.statSync(exePath);
                const k = exePath.toLowerCase();
                if (!apps.has(k)) {
                  apps.set(k, {
                    name: nameMap.get(curKey) || path.basename(exePath, '.exe'),
                    path: exePath,
                    type: 'app',
                    extension: '.exe',
                    category: 'applications',
                    size: stats.size,
                    created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || 0),
                    modified_at: Math.floor(stats.mtimeMs || 0),
                    indexed_at: Date.now(),
                    content_status: 'skipped',
                    content_fingerprint: null
                  });
                }
              }
            } catch (_e) { }
          }
        }
      } catch (_e) { /* registry query failed — skip */ }
    }

    // ── Windows Store / UWP apps via PowerShell (asynchronous, non-blocking) ──
    if (!this.cancelRequested) {
      try {
        const res = await execAsync(
          'powershell -NoProfile -NonInteractive -Command "Get-AppxPackage | Select-Object Name,InstallLocation | ConvertTo-Csv -NoTypeInformation"',
          { encoding: 'utf8', timeout: 5000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }
        );
        const psOut = res.stdout || '';
        const psLines = psOut.split('\n').slice(1);
        for (const line of psLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // CSV row format: "Name","InstallLocation"
          const parts = trimmed.replace(/^"|"$/g, '').split('","');
          if (parts.length < 2) continue;
          const pkgName = parts[0];
          const installLocation = parts[1];
          if (!installLocation || !fs.existsSync(installLocation)) continue;
          // Skip internal framework packages
          if (/Microsoft\.(NET|VCLibs|WindowsAppRuntime|DesktopAppInstaller\.Shim|UI\.Xaml)/i.test(pkgName)) continue;
          // Derive a friendly name
          const displayName = pkgName
            .replace(/^[^.]+\./, '')       // strip publisher prefix
            .replace(/_[\d.]+_.*$/, '')    // strip version+arch suffix
            .replace(/([A-Z])/g, ' $1').trim(); // CamelCase -> spaces
          const k = installLocation.toLowerCase();
          if (!apps.has(k)) {
            apps.set(k, {
              name: displayName || pkgName,
              path: installLocation,
              type: 'app',
              extension: '',
              category: 'applications',
              size: 0,
              created_at: 0,
              modified_at: Date.now(),
              indexed_at: Date.now(),
              content_status: 'skipped',
              content_fingerprint: null
            });
          }
        }
      } catch (_e) { /* PowerShell unavailable or timed out — skip */ }
    }

    return Array.from(apps.values());
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
   * @param {boolean} shallowAppsOnly - only index .exe files at depth ≤ 2 (for Program Files)
   */
  async scanDirectory(dirPath, isAppLocation = false, excludedList = [], maxDepth = 10, currentDepth = 0, visitedPaths = new Set(), shallowAppsOnly = false) {
    if (currentDepth > maxDepth || this.cancelRequested) return [];
    if (this.isPathExcluded(dirPath, excludedList)) return [];
    // For shallow app scans, stop recursing beyond depth 2
    if (shallowAppsOnly && currentDepth > 2) return [];

    let realDirPath = dirPath;
    try {
      realDirPath = await fs.promises.realpath(dirPath);
    } catch (_e) { }

    const realDirLower = realDirPath.toLowerCase();
    if (visitedPaths.has(realDirLower)) {
      return []; // Prevent infinite circular junction loops
    }
    visitedPaths.add(realDirLower);

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

      // Check if entry itself is ignored
      const entryLower = entry.name.toLowerCase();
      if (IGNORED_DIRS.has(entryLower) || (entry.name.startsWith('.') && entry.name.length > 1)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      if (this.isPathExcluded(fullPath, excludedList)) continue;

      try {
        if (entry.isDirectory()) {
          // In shallow-apps mode: don't index folders themselves — only recurse for exe discovery
          if (!shallowAppsOnly) {
            let folderStats = null;
            try { folderStats = await fs.promises.stat(fullPath); } catch (_e) { }
            results.push({
              name: entry.name,
              path: fullPath,
              type: 'folder',
              extension: '',
              category: 'folders',
              size: 0,
              created_at: folderStats ? Math.floor(folderStats.birthtimeMs || folderStats.ctimeMs || 0) : 0,
              modified_at: folderStats ? Math.floor(folderStats.mtimeMs || 0) : 0,
              indexed_at: Date.now(),
              content_status: 'skipped',
              content_fingerprint: null
            });
          }

          // Yield to event loop periodically
          if (results.length % 40 === 0) {
            await new Promise((r) => setImmediate(r));
          }

          // Recurse into child directory
          const children = await this.scanDirectory(fullPath, isAppLocation, excludedList, maxDepth, currentDepth + 1, visitedPaths, shallowAppsOnly);
          results.push(...children);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const isLnk = ext === '.lnk';

          // In shallow-apps mode: only collect .exe files
          if (shallowAppsOnly && ext !== '.exe') continue;

          const isApp = isAppLocation && (isLnk || ext === '.exe');

          let displayName = entry.name;
          if (isLnk) {
            // Strip .lnk for clean app display name
            displayName = path.basename(entry.name, '.lnk');
          } else if (shallowAppsOnly && ext === '.exe') {
            // Strip .exe extension for cleaner app name
            displayName = path.basename(entry.name, '.exe');
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
            type: isApp || shallowAppsOnly ? 'app' : 'file',
            extension: ext,
            category: this.categorize(ext, false, isApp || shallowAppsOnly),
            size: stats.size,
            created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || 0),
            modified_at: Math.floor(stats.mtimeMs || 0),
            indexed_at: Date.now(),
            content_status: isContentIndexable ? 'pending' : 'skipped',
            content_fingerprint: null
          });

          if (results.length % 50 === 0) {
            await new Promise((r) => setImmediate(r));
          }
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

      // Clean out any historical junk like node_modules
      if (typeof fileDao.purgeJunkRecords === 'function') {
        fileDao.purgeJunkRecords(db);
      }

      // Fetch excluded folders
      const excludedRows = db.prepare('SELECT folder_path FROM excluded_folders').all();
      const excludedList = excludedRows.map((r) => r.folder_path);

      const locations = options.locations || this.getDefaultLocations();
      this.emitUpdate({ status: 'Indexing files...', progress: -1 });

      let scannedCount = 0;

      // Index the root locations themselves so searching for "Downloads", "Desktop", etc. finds the folder
      for (const loc of locations) {
        if (this.cancelRequested) break;
        if (loc.type === 'folder' && fs.existsSync(loc.path) && !this.isPathExcluded(loc.path, excludedList)) {
          try {
            const stats = await fs.promises.stat(loc.path);
            const folderName = path.basename(loc.path) || loc.path;
            fileDao.upsertFile(db, {
              name: folderName,
              path: loc.path,
              type: 'folder',
              extension: '',
              category: 'folders',
              size: 0,
              created_at: Math.floor(stats.birthtimeMs || stats.ctimeMs || 0),
              modified_at: Math.floor(stats.mtimeMs || 0),
              indexed_at: Date.now(),
              content_status: 'skipped',
              content_fingerprint: null
            });
            scannedCount++;
          } catch (_e) { }
        }
      }

      for (const loc of locations) {
        if (this.cancelRequested) break;

        const isApp = loc.type === 'apps';
        const isShallowApps = loc.type === 'apps-shallow';
        const items = await this.scanDirectory(
          loc.path,
          isApp || isShallowApps,
          excludedList,
          isShallowApps ? 2 : 10,   // limit depth for Program Files
          0,
          new Set(),
          isShallowApps              // shallowAppsOnly flag
        );

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

      // ── Installed apps: registry + Windows Store ──────────────────────────
      const shouldScanApps = options.scanApps === true || (!options.locations && options.scanApps !== false);
      if (shouldScanApps && !this.cancelRequested) {
        this.emitUpdate({ status: 'Discovering installed apps...', progress: -1 });
        try {
          const installedApps = await this.scanInstalledApps();
          const chunkSize = 100;
          for (let i = 0; i < installedApps.length; i += chunkSize) {
            if (this.cancelRequested) break;
            const chunk = installedApps.slice(i, i + chunkSize);
            const trans = db.transaction(() => {
              for (const item of chunk) {
                fileDao.upsertFile(db, item);
              }
            });
            trans();
            scannedCount += chunk.length;
            await new Promise((r) => setImmediate(r));
          }
        } catch (appErr) {
          console.warn('[Indexer] App discovery partially failed:', appErr.message);
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
