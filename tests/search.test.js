import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const { search, sanitizeFtsQuery } = require('../electron/search.cjs');

describe('Search Service & Ranking Tests', () => {
  let testDbPath;
  let db;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `seekly_search_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);

    // Populate realistic test data
    fileDao.upsertFile(db, {
      name: 'spotify',
      path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\spotify.lnk',
      type: 'app',
      extension: '.lnk',
      category: 'applications',
      size: 1024,
      created_at: 1000,
      modified_at: 2000,
      indexed_at: 3000,
      content_status: 'skipped',
      content_fingerprint: null
    });

    fileDao.upsertFile(db, {
      name: 'spotify_playlist_backup.txt',
      path: 'C:\\Users\\User\\Documents\\spotify_playlist_backup.txt',
      type: 'file',
      extension: '.txt',
      category: 'documents',
      size: 5000,
      created_at: 1000,
      modified_at: 2000,
      indexed_at: 3000,
      content_status: 'pending',
      content_fingerprint: null
    });

    fileDao.upsertFile(db, {
      name: 'my_old_spotify.txt',
      path: 'C:\\Users\\User\\Downloads\\my_old_spotify.txt',
      type: 'file',
      extension: '.txt',
      category: 'documents',
      size: 2000,
      created_at: 1000,
      modified_at: 1500,
      indexed_at: 3000,
      content_status: 'pending',
      content_fingerprint: null
    });

    fileDao.upsertFile(db, {
      name: 'Invoices',
      path: 'C:\\Users\\User\\Documents\\Invoices',
      type: 'folder',
      extension: '',
      category: 'folders',
      size: 0,
      created_at: 1000,
      modified_at: 1000,
      indexed_at: 3000,
      content_status: 'skipped',
      content_fingerprint: null
    });

    // File with searchable document content
    const { lastInsertRowid: invoiceId } = fileDao.upsertFile(db, {
      name: 'Receipt_2026.pdf',
      path: 'C:\\Users\\User\\Documents\\Invoices\\Receipt_2026.pdf',
      type: 'file',
      extension: '.pdf',
      category: 'documents',
      size: 45000,
      created_at: 1000,
      modified_at: 2000,
      indexed_at: 3000,
      content_status: 'indexed',
      content_fingerprint: 'h1'
    });

    fileDao.insertDocumentContent(db, invoiceId, 3, 'Total amount due: $1,250.00 paid via QuantumPay.', 'Receipt_2026.pdf');
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch (_e) {}
  });

  it('sanitizes user input for FTS5 queries safely', () => {
    expect(sanitizeFtsQuery('hello world')).toBe('"hello"* AND "world"*');
    expect(sanitizeFtsQuery('test (parenthesis) & * special')).toBe('"test"* AND "parenthesis"* AND "special"*');
    expect(sanitizeFtsQuery('')).toBe('');
  });

  it('ranks exact match higher than prefix and substring matches', () => {
    const res = search('spotify', { mode: 'both' }, db);
    expect(res.results.length).toBeGreaterThanOrEqual(3);

    // Exact match (app) should be first
    expect(res.results[0].name.toLowerCase()).toBe('spotify');
    // Prefix match second
    expect(res.results[1].name).toBe('spotify_playlist_backup.txt');
    // Substring match third
    expect(res.results[2].name).toBe('my_old_spotify.txt');
  });

  it('finds folders by folder name', () => {
    const res = search('Invoices', { mode: 'filename' }, db);
    expect(res.results.length).toBeGreaterThanOrEqual(1);
    const folder = res.results.find(r => r.name === 'Invoices');
    expect(folder).toBeDefined();
    expect(folder.type).toBe('folder');
  });

  it('finds document content via FTS5 and returns snippets and page number', () => {
    const res = search('QuantumPay', { mode: 'both' }, db);
    expect(res.results.length).toBe(1);
    const doc = res.results[0];
    expect(doc.name).toBe('Receipt_2026.pdf');
    expect(doc.page_number).toBe(3);
    expect(doc.snippet).toContain('<mark>QuantumPay</mark>');
  });

  it('respects search mode filtering', () => {
    // QuantumPay is only in document content, not filename
    const resFilenameOnly = search('QuantumPay', { mode: 'filename' }, db);
    expect(resFilenameOnly.results.length).toBe(0);

    const resContentOnly = search('QuantumPay', { mode: 'content' }, db);
    expect(resContentOnly.results.length).toBe(1);

    // spotify is in filename, not content
    const resContentSpotify = search('spotify', { mode: 'content' }, db);
    expect(resContentSpotify.results.length).toBe(0);
  });
});
