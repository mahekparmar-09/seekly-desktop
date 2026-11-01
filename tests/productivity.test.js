import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const {
  recordSearch,
  getRecentSearches,
  deleteRecentSearch,
  clearRecentSearches,
  setHistoryEnabled
} = require('../electron/history.cjs');
const { toggleFavorite, getFavorites } = require('../electron/favorites.cjs');
const {
  getExcludedFolders,
  addExcludedFolder,
  removeExcludedFolder
} = require('../electron/privacy.cjs');
const { openFile, openFileLocation } = require('../electron/fileOpener.cjs');

describe('Productivity Features Tests', () => {
  let testDbPath;
  let db;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `seekly_prod_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);
    setHistoryEnabled(true);
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch (_e) {}
  });

  describe('Recent Searches', () => {
    it('records queries and prevents consecutive duplicates', () => {
      recordSearch('finance report', 'both', null, db);
      recordSearch('finance report', 'both', null, db); // Immediate duplicate
      recordSearch('budget 2026', 'content', null, db);

      const history = getRecentSearches(10, db);
      expect(history.length).toBe(2);
      expect(history[0].query).toBe('budget 2026');
      expect(history[1].query).toBe('finance report');
    });

    it('deletes specific history item and clears all', () => {
      const id1 = recordSearch('search one', 'both', null, db);
      const id2 = recordSearch('search two', 'both', null, db);

      deleteRecentSearch(id1, db);
      let history = getRecentSearches(10, db);
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(id2);

      clearRecentSearches(db);
      history = getRecentSearches(10, db);
      expect(history.length).toBe(0);
    });

    it('respects history privacy toggle', () => {
      setHistoryEnabled(false);
      recordSearch('private search', 'both', null, db);

      const history = getRecentSearches(10, db);
      expect(history.length).toBe(0);
    });
  });

  describe('Favorites System', () => {
    it('toggles favorites and returns favorited items', () => {
      // Create real temp file on disk so validation passes
      const tempFile = path.join(os.tmpdir(), `fav_${Date.now()}.txt`);
      fs.writeFileSync(tempFile, 'data');

      const { lastInsertRowid: fileId } = fileDao.upsertFile(db, {
        name: path.basename(tempFile),
        path: tempFile,
        type: 'file',
        extension: '.txt',
        category: 'documents',
        size: 4,
        created_at: 1000,
        modified_at: 1000,
        indexed_at: 1000,
        content_status: 'skipped',
        content_fingerprint: null
      });

      // Toggle ON
      const isFav1 = toggleFavorite(fileId, db);
      expect(isFav1).toBe(true);

      let favs = getFavorites(db);
      expect(favs.length).toBe(1);
      expect(favs[0].id).toBe(fileId);

      // Toggle OFF
      const isFav2 = toggleFavorite(fileId, db);
      expect(isFav2).toBe(false);

      favs = getFavorites(db);
      expect(favs.length).toBe(0);

      fs.unlinkSync(tempFile);
    });
  });

  describe('Privacy Exclusions', () => {
    it('adds and removes excluded folders and purges matching files', () => {
      const targetFolder = 'C:\\Users\\User\\PrivateFolder';
      const fileInside = `${targetFolder}\\confidential.pdf`;

      fileDao.upsertFile(db, {
        name: 'confidential.pdf',
        path: fileInside,
        type: 'file',
        extension: '.pdf',
        category: 'documents',
        size: 1000,
        created_at: 1000,
        modified_at: 1000,
        indexed_at: 1000,
        content_status: 'skipped',
        content_fingerprint: null
      });

      expect(fileDao.getFileByPath(db, fileInside)).toBeDefined();

      // Add folder to exclusions
      addExcludedFolder(targetFolder, db);

      const exclusions = getExcludedFolders(db);
      expect(exclusions.length).toBe(1);
      expect(exclusions[0].folder_path).toBe(path.normalize(targetFolder));

      // Verifies matching files were purged
      expect(fileDao.getFileByPath(db, fileInside)).toBeUndefined();

      // Remove exclusion
      removeExcludedFolder(targetFolder, db);
      expect(getExcludedFolders(db).length).toBe(0);
    });
  });

  describe('File Opener Validation', () => {
    it('rejects invalid or non-existent paths safely', async () => {
      const nonExistent = 'C:\\NonExistentPath\\FakeFile_99999.xyz';
      const resOpen = await openFile(nonExistent);
      expect(resOpen.success).toBe(false);
      expect(resOpen.error).toContain('does not exist');

      const resLoc = await openFileLocation(nonExistent);
      expect(resLoc.success).toBe(false);
      expect(resLoc.error).toContain('does not exist');
    });
  });
});
