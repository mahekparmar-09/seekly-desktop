import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const { search } = require('../electron/search.cjs');

describe('Advanced Search Filters Tests', () => {
  let testDbPath;
  let db;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `seekly_filter_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);

    // 1. Recent small document in Documents
    fileDao.upsertFile(db, {
      name: 'invoice_march.pdf',
      path: 'C:\\Users\\User\\Documents\\invoice_march.pdf',
      type: 'file',
      extension: '.pdf',
      category: 'documents',
      size: 500 * 1024, // 500 KB
      created_at: now - dayMs,
      modified_at: now - dayMs, // 1 day ago
      indexed_at: now,
      content_status: 'skipped',
      content_fingerprint: null
    });

    // 2. Older medium document in Downloads
    fileDao.upsertFile(db, {
      name: 'annual_report.docx',
      path: 'C:\\Users\\User\\Downloads\\annual_report.docx',
      type: 'file',
      extension: '.docx',
      category: 'documents',
      size: 4 * 1024 * 1024, // 4 MB
      created_at: now - 20 * dayMs,
      modified_at: now - 20 * dayMs, // 20 days ago
      indexed_at: now,
      content_status: 'skipped',
      content_fingerprint: null
    });

    // 3. Huge video on Desktop
    fileDao.upsertFile(db, {
      name: 'screencast.mp4',
      path: 'C:\\Users\\User\\Desktop\\screencast.mp4',
      type: 'file',
      extension: '.mp4',
      category: 'videos',
      size: 250 * 1024 * 1024, // 250 MB
      created_at: now - 40 * dayMs,
      modified_at: now - 40 * dayMs, // 40 days ago
      indexed_at: now,
      content_status: 'skipped',
      content_fingerprint: null
    });

    // 4. Image in Documents
    fileDao.upsertFile(db, {
      name: 'avatar.png',
      path: 'C:\\Users\\User\\Documents\\avatar.png',
      type: 'file',
      extension: '.png',
      category: 'images',
      size: 2 * 1024 * 1024, // 2 MB
      created_at: now - 2 * dayMs,
      modified_at: now - 2 * dayMs,
      indexed_at: now,
      content_status: 'skipped',
      content_fingerprint: null
    });
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch (_e) {}
  });

  it('filters by category accurately', () => {
    const docResults = search('', { category: 'documents', mode: 'filename' }, db);
    expect(docResults.results.length).toBe(2);
    expect(docResults.results.every(r => r.category === 'documents')).toBe(true);

    const videoResults = search('', { category: 'videos', mode: 'filename' }, db);
    expect(videoResults.results.length).toBe(1);
    expect(videoResults.results[0].name).toBe('screencast.mp4');
  });

  it('filters by file extension', () => {
    const pdfResults = search('', { fileType: '.pdf', mode: 'filename' }, db);
    expect(pdfResults.results.length).toBe(1);
    expect(pdfResults.results[0].name).toBe('invoice_march.pdf');
  });

  it('filters by modified date ranges', () => {
    const last7Days = search('', { dateRange: '7days', mode: 'filename' }, db);
    const names7 = last7Days.results.map(r => r.name);
    expect(names7).toContain('invoice_march.pdf');
    expect(names7).toContain('avatar.png');
    expect(names7).not.toContain('annual_report.docx'); // 20 days ago
    expect(names7).not.toContain('screencast.mp4'); // 40 days ago
  });

  it('filters by file size intervals', () => {
    const smallFiles = search('', { sizeRange: '<1MB', mode: 'filename' }, db);
    expect(smallFiles.results.length).toBe(1);
    expect(smallFiles.results[0].name).toBe('invoice_march.pdf');

    const hugeFiles = search('', { sizeRange: '>100MB', mode: 'filename' }, db);
    expect(hugeFiles.results.length).toBe(1);
    expect(hugeFiles.results[0].name).toBe('screencast.mp4');
  });

  it('filters by location prefix', () => {
    const docFolderResults = search('', { location: 'C:\\Users\\User\\Documents', mode: 'filename' }, db);
    expect(docFolderResults.results.length).toBe(2);
    const names = docFolderResults.results.map(r => r.name);
    expect(names).toContain('invoice_march.pdf');
    expect(names).toContain('avatar.png');
    expect(names).not.toContain('annual_report.docx');
  });

  it('sorts by size descending and name ascending', () => {
    const sortedBySize = search('', { sortBy: 'size', mode: 'filename' }, db);
    expect(sortedBySize.results[0].name).toBe('screencast.mp4'); // 250 MB
    expect(sortedBySize.results[sortedBySize.results.length - 1].name).toBe('invoice_march.pdf'); // 500 KB

    const sortedByName = search('', { sortBy: 'name', mode: 'filename' }, db);
    expect(sortedByName.results[0].name).toBe('annual_report.docx');
  });

  it('combines multiple filters together simultaneously', () => {
    // Documents category + Modified within 7 days + Size < 1MB + In Documents folder
    const combined = search('', {
      category: 'documents',
      dateRange: '7days',
      sizeRange: '<1MB',
      location: 'C:\\Users\\User\\Documents',
      mode: 'filename'
    }, db);

    expect(combined.results.length).toBe(1);
    expect(combined.results[0].name).toBe('invoice_march.pdf');
  });
});
