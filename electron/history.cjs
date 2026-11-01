const { getDatabase } = require('./database.cjs');

let isHistoryEnabled = true;

/**
 * Configure history tracking
 * @param {boolean} enabled
 */
function setHistoryEnabled(enabled) {
  isHistoryEnabled = !!enabled;
}

function getHistoryEnabled() {
  return isHistoryEnabled;
}

/**
 * Record a search query into SQLite
 * @param {string} query
 * @param {string} searchMode
 * @param {object} [filterData]
 * @param {import('better-sqlite3').Database} [customDb]
 */
function recordSearch(query, searchMode = 'both', filterData = null, customDb = null) {
  if (!isHistoryEnabled) return null;
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 2) return null;

  const db = customDb || getDatabase();

  // Check last inserted search to avoid rapid duplicate records
  const last = db.prepare('SELECT id, query FROM recent_searches ORDER BY searched_at DESC LIMIT 1').get();
  if (last && last.query.toLowerCase() === trimmed.toLowerCase()) {
    // Update timestamp instead of adding duplicate
    db.prepare('UPDATE recent_searches SET searched_at = ? WHERE id = ?').run(Date.now(), last.id);
    return last.id;
  }

  const stmt = db.prepare(`
    INSERT INTO recent_searches (query, search_mode, filter_data, searched_at)
    VALUES (?, ?, ?, ?)
  `);

  const info = stmt.run(
    trimmed,
    searchMode,
    filterData ? JSON.stringify(filterData) : null,
    Date.now()
  );

  // Keep history table capped at top 50 items
  db.prepare(`
    DELETE FROM recent_searches 
    WHERE id NOT IN (
      SELECT id FROM recent_searches ORDER BY searched_at DESC LIMIT 50
    )
  `).run();

  return info.lastInsertRowid;
}

/**
 * Retrieve recent searches
 * @param {number} [limit=10]
 * @param {import('better-sqlite3').Database} [customDb]
 */
function getRecentSearches(limit = 10, customDb = null) {
  const db = customDb || getDatabase();
  return db.prepare(`
    SELECT * FROM recent_searches 
    ORDER BY searched_at DESC 
    LIMIT ?
  `).all(limit);
}

/**
 * Delete a specific history entry
 * @param {number} id
 * @param {import('better-sqlite3').Database} [customDb]
 */
function deleteRecentSearch(id, customDb = null) {
  const db = customDb || getDatabase();
  const info = db.prepare('DELETE FROM recent_searches WHERE id = ?').run(id);
  return info.changes > 0;
}

/**
 * Clear all search history
 * @param {import('better-sqlite3').Database} [customDb]
 */
function clearRecentSearches(customDb = null) {
  const db = customDb || getDatabase();
  db.prepare('DELETE FROM recent_searches').run();
  return true;
}

module.exports = {
  recordSearch,
  getRecentSearches,
  deleteRecentSearch,
  clearRecentSearches,
  setHistoryEnabled,
  getHistoryEnabled
};
