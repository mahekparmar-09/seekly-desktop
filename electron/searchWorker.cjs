/**
 * searchWorker.cjs
 * Runs inside a worker_threads Worker so all SQLite queries execute
 * off the main process thread — preventing any "Not Responding" freeze.
 */
'use strict';

const { workerData, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');

// ── helpers ────────────────────────────────────────────────────────────────

// Common English stopwords to avoid freezing FTS with table-scanning prefix wildcards
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours'
]);

function buildFtsQueries(query) {
  if (!query || typeof query !== 'string') return { andQuery: '', orQuery: '' };
  const tokens = query
    .trim()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return { andQuery: '', orQuery: '' };

  const substantive = tokens.filter((t) => !STOPWORDS.has(t.toLowerCase()) && t.length >= 2);
  const activeTokens = substantive.length > 0 ? substantive : tokens;

  // Never use wildcard '*' on stopwords or tokens < 3 chars to prevent slow table scans
  const formatToken = (t) => {
    const isStop = STOPWORDS.has(t.toLowerCase());
    if (isStop || t.length < 3) return `"${t}"`;
    return `"${t}"*`;
  };

  const andQuery = activeTokens.map(formatToken).join(' AND ');
  const orQuery = activeTokens.length > 1 ? activeTokens.map(formatToken).join(' OR ') : '';

  return { andQuery, orQuery };
}

function sanitizeFtsQuery(query) {
  return buildFtsQueries(query).andQuery;
}

// ── open database ──────────────────────────────────────────────────────────
const dbPath = workerData.dbPath;

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: false });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
// Speed up reads inside the worker
db.pragma('cache_size = -8000');   // 8 MB page cache
db.pragma('temp_store = MEMORY');

// ── search ─────────────────────────────────────────────────────────────────

function search(rawQuery, options = {}) {
  const query = (rawQuery || '').trim();
  const mode = options.mode || 'both';
  const limit = options.limit || 30;
  const offset = options.offset || 0;
  const sortBy = options.sortBy || 'relevance';

  const hasFilter = !!(
    query ||
    options.category ||
    options.fileType ||
    options.dateRange ||
    options.sizeRange ||
    options.location ||
    options.sortBy
  );
  if (!hasFilter) return { results: [], total: 0, query: '' };

  const queryLower = query.toLowerCase();
  const resultsMap = new Map();

  // ── 1. Filename / metadata search ─────────────────────────────────────
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

    if (options.category && options.category !== 'all') {
      if (options.category === 'folders') {
        sql += ` AND f.type = 'folder'`;
      } else {
        sql += ` AND f.category = ?`;
        params.push(options.category);
      }
    }

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

    if (options.location && options.location !== 'all') {
      sql += ` AND f.path LIKE ?`;
      params.push(`${options.location}%`);
    }

    if (sortBy === 'name') {
      sql += ` ORDER BY f.name COLLATE NOCASE ASC LIMIT 250`;
    } else if (sortBy === 'modified') {
      sql += ` ORDER BY f.modified_at DESC LIMIT 250`;
    } else if (sortBy === 'size') {
      sql += ` ORDER BY f.size DESC LIMIT 250`;
    } else {
      if (query) {
        sql += ` ORDER BY
          CASE
            WHEN LOWER(f.name) = LOWER(?) THEN 1
            WHEN LOWER(f.name) LIKE ? THEN 2
            WHEN LOWER(f.name) LIKE ? THEN 3
            ELSE 4
          END,
          (f.type = 'folder') DESC,
          (f.type = 'app') DESC,
          f.modified_at DESC
          LIMIT 250`;
        params.push(query, `${query}%`, `%${query}%`);
      } else {
        sql += ` ORDER BY (f.type = 'folder') DESC, f.modified_at DESC LIMIT 250`;
      }
    }

    try {
      const rows = db.prepare(sql).all(...params);
      for (const row of rows) {
        let score = 0;
        const nameLower = row.name.toLowerCase();

        if (nameLower === queryLower) {
          score += 1000;
        } else if (nameLower.startsWith(queryLower)) {
          score += 600;
        } else if (nameLower.includes(queryLower)) {
          score += 350;
        } else {
          score += 50;
        }

        if (row.type === 'folder') score += 150;
        else if (row.type === 'app') score += 100;

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
      console.error('[SearchWorker] Metadata search error:', err.message);
    }
  }

  // ── 2. FTS5 content search ─────────────────────────────────────────────
  const isFolderFilter = options.fileType === 'folders' || options.category === 'folders';
  const isAppFilter = options.fileType === 'apps' || options.category === 'applications';
  const isImageFilter = options.fileType === 'images' || options.category === 'images';
  const isShortQuery = query.length < 3;
  const shouldRunFts = (mode === 'content') || (mode === 'both' && !isShortQuery);

  if (shouldRunFts && query && !isFolderFilter && !isAppFilter && !isImageFilter) {
    const { andQuery, orQuery } = buildFtsQueries(query);
    const queriesToRun = [];
    if (andQuery) queriesToRun.push({ ftsQuery: andQuery, isAnd: true });
    if (orQuery && orQuery !== andQuery) queriesToRun.push({ ftsQuery: orQuery, isAnd: false });

    for (const { ftsQuery, isAnd } of queriesToRun) {
      if (!isAnd && resultsMap.size >= 25) break;

      try {
        let ftsSql = `
          SELECT
            fts.file_id,
            fts.page_number,
            fts.rank,
            snippet(document_content_fts, -1, '<mark>', '</mark>', '...', 18) as snippet,
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
            AND f.type != 'folder'
        `;
        const ftsParams = [ftsQuery];

        if (options.fileType && options.fileType !== 'all') {
          const ext = options.fileType.startsWith('.') ? options.fileType : `.${options.fileType}`;
          ftsSql += ` AND f.extension = ?`;
          ftsParams.push(ext.toLowerCase());
        }
        if (options.category && options.category !== 'all') {
          ftsSql += ` AND f.category = ?`;
          ftsParams.push(options.category);
        }
        if (options.location && options.location !== 'all') {
          ftsSql += ` AND f.path LIKE ?`;
          ftsParams.push(`${options.location}%`);
        }

        ftsSql += ` ORDER BY fts.rank LIMIT 60`;

        const ftsRows = db.prepare(ftsSql).all(...ftsParams);
        for (const row of ftsRows) {
          if (resultsMap.has(row.file_id)) {
            const existing = resultsMap.get(row.file_id);
            existing.score += isAnd ? 400 : 200;
            if (!existing.snippet) {
              existing.snippet = row.snippet;
              existing.page_number = row.page_number;
            }
            existing.matchType = 'both';
          } else if (mode !== 'filename') {
            const baseBonus = isAnd ? 220 : 140;
            const contentScore = Math.max(10, Math.round(baseBonus - (row.rank || 0) * 10));
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
        console.error('[SearchWorker] FTS5 search error:', err.message);
      }
    }
  }

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

  return { results: paginatedResults, total, query, mode };
}

// ── message loop ───────────────────────────────────────────────────────────
parentPort.on('message', ({ id, type, payload }) => {
  try {
    if (type === 'search') {
      const result = search(payload.query, payload.options);
      parentPort.postMessage({ id, result });
    } else {
      parentPort.postMessage({ id, result: null });
    }
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});
