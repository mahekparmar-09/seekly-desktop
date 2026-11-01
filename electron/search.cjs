const { getDatabase } = require('./database.cjs');

/**
 * Sanitize query string for safe SQLite FTS5 MATCH syntax
 * @param {string} query
 * @returns {string}
 */
function sanitizeFtsQuery(query) {
  if (!query || typeof query !== 'string') return '';
  // Split into alphanumeric/word tokens and format for prefix matching
  const tokens = query
    .trim()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return '';
  // Each token gets prefix wildcard for real-time typing match
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

/**
 * Execute search with ranking and filters
 * @param {string} rawQuery
 * @param {object} options
 * @param {import('better-sqlite3').Database} [customDb]
 */
function search(rawQuery, options = {}, customDb = null) {
  const db = customDb || getDatabase();
  const query = (rawQuery || '').trim();
  const mode = options.mode || 'both'; // 'both' | 'filename' | 'content'
  const limit = options.limit || 30;
  const offset = options.offset || 0;
  const sortBy = options.sortBy || 'relevance';

  const hasFilter = !!(query || options.category || options.fileType || options.dateRange || options.sizeRange || options.location || options.sortBy);
  if (!hasFilter) {
    return { results: [], total: 0, query: '' };
  }

  const queryLower = query.toLowerCase();
  const resultsMap = new Map();

  // 1. FILENAME & METADATA SEARCH (if mode is 'both' or 'filename')
  if (mode === 'both' || mode === 'filename') {
    let sql = `
      SELECT 
        f.*,
        fav.id as is_favorite
      FROM files f
      LEFT JOIN favorites fav ON fav.file_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (query) {
      sql += ` AND (f.name LIKE ? OR f.path LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`);
    }

    // Apply Filter: File Type
    if (options.fileType && options.fileType !== 'all') {
      if (options.fileType === 'folders') {
        sql += ` AND f.type = 'folder'`;
      } else if (options.fileType === 'apps') {
        sql += ` AND f.type = 'app'`;
      } else if (options.fileType === 'images') {
        sql += ` AND f.category = 'images'`;
      } else {
        const ext = options.fileType.startsWith('.') ? options.fileType : `.${options.fileType}`;
        sql += ` AND f.extension = ?`;
        params.push(ext.toLowerCase());
      }
    }

    // Apply Filter: Category
    if (options.category && options.category !== 'all') {
      sql += ` AND f.category = ?`;
      params.push(options.category);
    }

    // Apply Filter: Modified Date
    if (options.dateRange && options.dateRange !== 'any') {
      const now = Date.now();
      let threshold = 0;
      if (options.dateRange === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        threshold = startOfDay.getTime();
      } else if (options.dateRange === '7days') {
        threshold = now - 7 * 24 * 60 * 60 * 1000;
      } else if (options.dateRange === '30days') {
        threshold = now - 30 * 24 * 60 * 60 * 1000;
      }
      if (threshold > 0) {
        sql += ` AND f.modified_at >= ?`;
        params.push(threshold);
      }
    }

    // Apply Filter: File Size
    if (options.sizeRange && options.sizeRange !== 'any') {
      if (options.sizeRange === '<1MB') {
        sql += ` AND f.size < ?`;
        params.push(1024 * 1024);
      } else if (options.sizeRange === '1-10MB') {
        sql += ` AND f.size >= ? AND f.size <= ?`;
        params.push(1024 * 1024, 10 * 1024 * 1024);
      } else if (options.sizeRange === '10-100MB') {
        sql += ` AND f.size >= ? AND f.size <= ?`;
        params.push(10 * 1024 * 1024, 100 * 1024 * 1024);
      } else if (options.sizeRange === '>100MB') {
        sql += ` AND f.size > ?`;
        params.push(100 * 1024 * 1024);
      }
    }

    // Apply Filter: Location
    if (options.location && options.location !== 'all') {
      sql += ` AND f.path LIKE ?`;
      params.push(`${options.location}%`);
    }

    // Sorting (if not relevance)
    if (sortBy === 'name') {
      sql += ` ORDER BY f.name COLLATE NOCASE ASC`;
    } else if (sortBy === 'modified') {
      sql += ` ORDER BY f.modified_at DESC`;
    } else if (sortBy === 'size') {
      sql += ` ORDER BY f.size DESC`;
    } else {
      sql += ` LIMIT 150`; // Take top candidates for in-memory score ranking
    }

    try {
      const rows = db.prepare(sql).all(...params);
      for (const row of rows) {
        let score = 0;
        const nameLower = row.name.toLowerCase();

        if (nameLower === queryLower) {
          score += 1000; // Exact filename match
        } else if (nameLower.startsWith(queryLower)) {
          score += 500; // Filename prefix
        } else if (nameLower.includes(queryLower)) {
          score += 250; // Filename substring
        } else {
          score += 50; // Path match
        }

        // App boost
        if (row.type === 'app') {
          score += 80;
        }

        resultsMap.set(row.id, {
          ...row,
          is_favorite: !!row.is_favorite,
          matchType: 'filename',
          score,
          snippet: null,
          page_number: null
        });
      }
    } catch (err) {
      console.error('[Search] Metadata search error:', err);
    }
  }

  // 2. FTS5 DOCUMENT CONTENT SEARCH (if mode is 'both' or 'content')
  if ((mode === 'both' || mode === 'content') && query) {
    const ftsQuery = sanitizeFtsQuery(query);
    if (ftsQuery) {
      try {
        const ftsSql = `
          SELECT 
            fts.file_id,
            fts.page_number,
            fts.rank,
            snippet(document_content_fts, 3, '<mark>', '</mark>', '...', 18) as snippet,
            f.name,
            f.path,
            f.type,
            f.extension,
            f.category,
            f.size,
            f.modified_at,
            fav.id as is_favorite
          FROM document_content_fts fts
          JOIN files f ON f.id = fts.file_id
          LEFT JOIN favorites fav ON fav.file_id = f.id
          WHERE document_content_fts MATCH ?
          ORDER BY fts.rank
          LIMIT 60
        `;

        const ftsRows = db.prepare(ftsSql).all(ftsQuery);

        for (const row of ftsRows) {
          // If already in resultsMap (from filename match), enhance with snippet and boost score!
          if (resultsMap.has(row.file_id)) {
            const existing = resultsMap.get(row.file_id);
            existing.score += 350; // Boost for matching both filename and content
            existing.snippet = row.snippet;
            existing.page_number = row.page_number;
            existing.matchType = 'both';
          } else if (mode !== 'filename') {
            // New content match
            const contentScore = Math.max(10, Math.round(180 - (row.rank || 0) * 10));
            resultsMap.set(row.file_id, {
              id: row.file_id,
              name: row.name,
              path: row.path,
              type: row.type,
              extension: row.extension,
              category: row.category,
              size: row.size,
              modified_at: row.modified_at,
              is_favorite: !!row.is_favorite,
              matchType: 'content',
              score: contentScore,
              snippet: row.snippet,
              page_number: row.page_number
            });
          }
        }
      } catch (err) {
        console.error('[Search] FTS5 search error:', err);
      }
    }
  }

  // Convert to array and sort by calculated score if relevance sorting
  let allResults = Array.from(resultsMap.values());

  if (sortBy === 'relevance') {
    allResults.sort((a, b) => b.score - a.score || b.modified_at - a.modified_at);
  } else if (sortBy === 'name') {
    allResults.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'modified') {
    allResults.sort((a, b) => b.modified_at - a.modified_at);
  } else if (sortBy === 'size') {
    allResults.sort((a, b) => b.size - a.size);
  }

  const total = allResults.length;
  const paginatedResults = allResults.slice(offset, offset + limit);

  return {
    results: paginatedResults,
    total,
    query,
    mode
  };
}

module.exports = {
  search,
  sanitizeFtsQuery
};
