const path = require('path');
const { getDatabase, fileDao } = require('./database.cjs');

/**
 * Get all excluded folder paths
 * @param {import('better-sqlite3').Database} [customDb]
 */
function getExcludedFolders(customDb = null) {
  const db = customDb || getDatabase();
  return db.prepare('SELECT * FROM excluded_folders ORDER BY folder_path ASC').all();
}

/**
 * Add a folder to privacy exclusions
 * Also purges any currently indexed files inside that folder
 * @param {string} folderPath
 * @param {import('better-sqlite3').Database} [customDb]
 */
function addExcludedFolder(folderPath, customDb = null) {
  if (!folderPath || typeof folderPath !== 'string') return false;
  const db = customDb || getDatabase();
  const normalized = path.normalize(folderPath);

  const existing = db.prepare('SELECT id FROM excluded_folders WHERE folder_path = ?').get(normalized);
  if (existing) return true;

  const trans = db.transaction(() => {
    db.prepare('INSERT INTO excluded_folders (folder_path, created_at) VALUES (?, ?)').run(normalized, Date.now());

    // Purge any files and document content under this path
    const matchingFiles = db.prepare('SELECT path FROM files WHERE path = ? OR path LIKE ?').all(
      normalized,
      `${normalized}${path.sep}%`
    );

    for (const f of matchingFiles) {
      fileDao.deleteFileByPath(db, f.path);
    }
  });

  trans();
  return true;
}

/**
 * Remove a folder from privacy exclusions
 * @param {string} folderPath
 * @param {import('better-sqlite3').Database} [customDb]
 */
function removeExcludedFolder(folderPath, customDb = null) {
  if (!folderPath) return false;
  const db = customDb || getDatabase();
  const normalized = path.normalize(folderPath);
  db.prepare('DELETE FROM excluded_folders WHERE folder_path = ?').run(normalized);
  return true;
}

module.exports = {
  getExcludedFolders,
  addExcludedFolder,
  removeExcludedFolder
};
