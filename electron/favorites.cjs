const fs = require('fs');
const { getDatabase, fileDao } = require('./database.cjs');

/**
 * Toggle favorite state for a file
 * @param {number} fileId
 * @param {import('better-sqlite3').Database} [customDb]
 * @returns {boolean} isFavorite now
 */
function toggleFavorite(fileId, customDb = null) {
  const db = customDb || getDatabase();
  const existing = db.prepare('SELECT id FROM favorites WHERE file_id = ?').get(fileId);

  if (existing) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
    return false;
  } else {
    // Verify file exists
    const file = fileDao.getFileById(db, fileId);
    if (!file) return false;

    db.prepare('INSERT INTO favorites (file_id, created_at) VALUES (?, ?)').run(fileId, Date.now());
    return true;
  }
}

/**
 * Retrieve all favorite files with validated filesystem existence
 * @param {import('better-sqlite3').Database} [customDb]
 */
function getFavorites(customDb = null) {
  const db = customDb || getDatabase();
  const rows = db.prepare(`
    SELECT 
      f.*,
      fav.created_at as favorited_at,
      1 as is_favorite
    FROM favorites fav
    JOIN files f ON f.id = fav.file_id
    ORDER BY fav.created_at DESC
  `).all();

  // Filter out any files that were deleted from disk outside Seekly
  const validFavorites = [];
  for (const row of rows) {
    if (fs.existsSync(row.path)) {
      validFavorites.push(row);
    } else {
      // Clean up orphaned favorite and file record
      fileDao.deleteFileByPath(db, row.path);
    }
  }

  return validFavorites;
}

module.exports = {
  toggleFavorite,
  getFavorites
};
