import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const { Indexer } = require('../electron/indexer.cjs');
const { DocumentIndexer } = require('../electron/documentIndexer.cjs');
const { search } = require('../electron/search.cjs');
const { recordSearch, getRecentSearches } = require('../electron/history.cjs');
const { toggleFavorite, getFavorites } = require('../electron/favorites.cjs');
const { addExcludedFolder } = require('../electron/privacy.cjs');

describe('End-to-End Search & Indexing Flow', () => {
  let testDbPath;
  let db;
  let workspaceDir;

  beforeEach(async () => {
    testDbPath = path.join(os.tmpdir(), `seekly_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);

    workspaceDir = path.join(os.tmpdir(), `seekly_e2e_ws_${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Create a real file on disk
    fs.writeFileSync(
      path.join(workspaceDir, 'Architecture.txt'),
      'Seekly uses Electron, React, Vite and SQLite FTS5 for local desktop indexing.'
    );

    fs.writeFileSync(
      path.join(workspaceDir, 'Logo.png'),
      'image-data'
    );
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(workspaceDir)) fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch (_e) {}
  });

  it('performs complete end-to-end cycle: indexing -> content extraction -> search -> favorite -> history', async () => {
    // 1. Metadata indexing
    const indexer = new Indexer(db);
    await indexer.startIndexing({ locations: [{ path: workspaceDir, type: 'folder' }] });

    const stats = fileDao.getStats(db);
    expect(stats.totalFiles).toBeGreaterThanOrEqual(2);

    // 2. Document content indexing
    const docIndexer = new DocumentIndexer(db);
    await docIndexer.processPendingDocuments();

    const docStats = fileDao.getStats(db);
    expect(docStats.extractedDocuments).toBe(1);

    // 3. Search by content keyword
    const contentResult = search('FTS5', { mode: 'both' }, db);
    expect(contentResult.results.length).toBe(1);
    expect(contentResult.results[0].name).toBe('Architecture.txt');
    expect(contentResult.results[0].snippet).toContain('<mark>FTS5</mark>');

    // 4. Record search history
    recordSearch('FTS5', 'both', null, db);
    const history = getRecentSearches(5, db);
    expect(history.length).toBe(1);
    expect(history[0].query).toBe('FTS5');

    // 5. Favorite item
    const fileId = contentResult.results[0].id;
    toggleFavorite(fileId, db);
    const favs = getFavorites(db);
    expect(favs.length).toBe(1);
    expect(favs[0].id).toBe(fileId);

    // 6. Privacy exclusion purges from search
    addExcludedFolder(workspaceDir, db);
    const afterExclusion = search('Architecture', { mode: 'both' }, db);
    expect(afterExclusion.results.length).toBe(0);
  });
});
