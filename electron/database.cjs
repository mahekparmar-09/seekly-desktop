const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

/**
 * Resolve the database path.
 * If running inside Electron, use app.getPath('userData').
 * If a custom path is specified (e.g. for testing), use that.
 */
function resolveDbPath(customPath = null) {
  if (customPath) return customPath;

  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      const userData = app.getPath('userData');
      if (!fs.existsSync(userData)) {
        fs.mkdirSync(userData, { recursive: true });
      }
      return path.join(userData, 'seekly.db');
    }
  } catch (_e) {
    // Electron not available or in standalone test
  }

  // Fallback to local data folder if outside Electron
  const fallbackDir = path.join(process.cwd(), '.seekly-data');
  if (!fs.existsSync(fallbackDir)) {
    fs.mkdirSync(fallbackDir, { recursive: true });
  }
  return path.join(fallbackDir, 'seekly.db');
}

/**
 * Initialize SQLite database with FTS5 and schema migrations
 * @param {string} [customPath]
 * @returns {import('better-sqlite3').Database}
 */
function initDatabase(customPath = null) {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath(customPath);
  const db = new Database(dbPath);

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  dbInstance = db;
  return dbInstance;
}

/**
 * Get active database instance
 */
function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_err) {}
    dbInstance = null;
  }
}

/**
 * Schema migrations
 */
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const currentVersionRow = db.prepare('SELECT MAX(version) as version FROM schema_versions').get();
  const currentVersion = currentVersionRow?.version || 0;

  if (currentVersion < 1) {
    applyMigrationV1(db);
  }
}

function applyMigrationV1(db) {
  const transaction = db.transaction(() => {
    // 1. Files metadata table
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL, /* 'file', 'folder', 'app' */
        extension TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'other', /* 'documents', 'images', 'videos', 'audio', 'folders', 'applications', 'other' */
        size INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        modified_at INTEGER NOT NULL DEFAULT 0,
        indexed_at INTEGER NOT NULL DEFAULT 0,
        content_status TEXT NOT NULL DEFAULT 'skipped', /* 'pending', 'indexed', 'failed', 'unsupported', 'skipped' */
        content_fingerprint TEXT DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_name ON files(name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
      CREATE INDEX IF NOT EXISTS idx_files_modified_at ON files(modified_at DESC);
      CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
      CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
      CREATE INDEX IF NOT EXISTS idx_files_content_status ON files(content_status);
    `);

    // 2. Document content table (preserves page numbers)
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        page_number INTEGER DEFAULT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_doc_file_id ON document_content(file_id);
    `);

    // 3. SQLite FTS5 Virtual Table for full-text searching
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS document_content_fts USING fts5(
        file_id UNINDEXED,
        page_number UNINDEXED,
        name,
        content,
        tokenize = 'porter unicode61'
      );
    `);

    // 4. Recent Searches
    db.exec(`
      CREATE TABLE IF NOT EXISTS recent_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        search_mode TEXT NOT NULL DEFAULT 'both',
        filter_data TEXT DEFAULT NULL,
        searched_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recent_searched_at ON recent_searches(searched_at DESC);
    `);

    // 5. Favorites
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE UNIQUE,
        created_at INTEGER NOT NULL
      );
    `);

    // 6. Excluded Folders
    db.exec(`
      CREATE TABLE IF NOT EXISTS excluded_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
    `);

    // Record migration
    db.prepare('INSERT INTO schema_versions (version, applied_at) VALUES (1, ?)').run(Date.now());
  });

  transaction();
}

/**
 * File DAO methods
 */
const fileDao = {
  upsertFile(db, record) {
    const stmt = db.prepare(`
      INSERT INTO files (
        name, path, type, extension, category, size, created_at, modified_at, indexed_at, content_status, content_fingerprint
      ) VALUES (
        @name, @path, @type, @extension, @category, @size, @created_at, @modified_at, @indexed_at, @content_status, @content_fingerprint
      )
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        extension = excluded.extension,
        category = excluded.category,
        size = excluded.size,
        modified_at = excluded.modified_at,
        indexed_at = excluded.indexed_at,
        content_status = CASE 
          WHEN files.modified_at != excluded.modified_at THEN excluded.content_status 
          ELSE files.content_status 
        END,
        content_fingerprint = excluded.content_fingerprint
    `);
    return stmt.run(record);
  },

  getFileByPath(db, filePath) {
    return db.prepare('SELECT * FROM files WHERE path = ?').get(filePath);
  },

  getFileById(db, id) {
    return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
  },

  deleteFileByPath(db, filePath) {
    const file = db.prepare('SELECT id FROM files WHERE path = ?').get(filePath);
    if (file) {
      this.deleteDocumentContent(db, file.id);
      db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
      return true;
    }
    return false;
  },

  updateContentStatus(db, fileId, status, fingerprint = null) {
    return db.prepare(`
      UPDATE files 
      SET content_status = ?, content_fingerprint = COALESCE(?, content_fingerprint), indexed_at = ?
      WHERE id = ?
    `).run(status, fingerprint, Date.now(), fileId);
  },

  insertDocumentContent(db, fileId, pageNumber, content, name) {
    const trans = db.transaction(() => {
      // Insert into normalized document_content table
      db.prepare(`
        INSERT INTO document_content (file_id, page_number, content, created_at)
        VALUES (?, ?, ?, ?)
      `).run(fileId, pageNumber, content, Date.now());

      // Insert into FTS5 virtual table
      db.prepare(`
        INSERT INTO document_content_fts (file_id, page_number, name, content)
        VALUES (?, ?, ?, ?)
      `).run(fileId, pageNumber, name, content);
    });

    trans();
  },

  deleteDocumentContent(db, fileId) {
    const trans = db.transaction(() => {
      db.prepare('DELETE FROM document_content WHERE file_id = ?').run(fileId);
      db.prepare('DELETE FROM document_content_fts WHERE file_id = ?').run(fileId);
    });
    trans();
  },

  getPendingContentFiles(db, limit = 20) {
    return db.prepare(`
      SELECT * FROM files 
      WHERE content_status = 'pending'
      ORDER BY modified_at DESC
      LIMIT ?
    `).all(limit);
  },

  getStats(db) {
    const totalFiles = db.prepare('SELECT COUNT(*) as count FROM files').get()?.count || 0;
    const totalDocuments = db.prepare(`
      SELECT COUNT(*) as count FROM files 
      WHERE extension IN ('.pdf', '.docx', '.txt')
    `).get()?.count || 0;
    const extractedDocuments = db.prepare(`
      SELECT COUNT(DISTINCT file_id) as count FROM document_content
    `).get()?.count || 0;
    const failedDocuments = db.prepare(`
      SELECT COUNT(*) as count FROM files 
      WHERE content_status = 'failed'
    `).get()?.count || 0;
    const lastIndexedRow = db.prepare('SELECT MAX(indexed_at) as lastIndexed FROM files').get();

    return {
      totalFiles,
      totalDocuments,
      extractedDocuments,
      failedDocuments,
      lastIndexedAt: lastIndexedRow?.lastIndexed || null
    };
  }
};

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  fileDao
};
