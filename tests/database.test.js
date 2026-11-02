import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');

describe('Database & FTS5 Schema Tests', () => {
  let testDbPath;
  let db;

  beforeEach(() => {
    // Unique test database in temp folder
    testDbPath = path.join(os.tmpdir(), `seekly_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (_e) {}
    }
  });

  it('initializes schema and version table correctly', () => {
    const versionRow = db.prepare('SELECT MAX(version) as version FROM schema_versions').get();
    expect(versionRow.version).toBeGreaterThanOrEqual(1);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    expect(tables).toContain('files');
    expect(tables).toContain('document_content');
    expect(tables).toContain('document_content_fts');
    expect(tables).toContain('recent_searches');
    expect(tables).toContain('favorites');
    expect(tables).toContain('excluded_folders');
  });

  it('inserts and retrieves file metadata', () => {
    const fileRecord = {
      name: 'ProjectPlan.docx',
      path: 'C:\\Users\\Test\\Documents\\ProjectPlan.docx',
      type: 'file',
      extension: '.docx',
      category: 'documents',
      size: 1048576,
      created_at: 1700000000000,
      modified_at: 1700001000000,
      indexed_at: 1700002000000,
      content_status: 'pending',
      content_fingerprint: null
    };

    fileDao.upsertFile(db, fileRecord);
    const retrieved = fileDao.getFileByPath(db, fileRecord.path);

    expect(retrieved).toBeDefined();
    expect(retrieved.name).toBe('ProjectPlan.docx');
    expect(retrieved.size).toBe(1048576);
    expect(retrieved.category).toBe('documents');
    expect(retrieved.content_status).toBe('pending');
  });

  it('prevents duplicate file records and updates on conflict', () => {
    const original = {
      name: 'QuarterlyReport.pdf',
      path: 'C:\\Users\\Test\\Documents\\QuarterlyReport.pdf',
      type: 'file',
      extension: '.pdf',
      category: 'documents',
      size: 50000,
      created_at: 1700000000000,
      modified_at: 1700001000000,
      indexed_at: 1700002000000,
      content_status: 'pending',
      content_fingerprint: 'hash1'
    };
    fileDao.upsertFile(db, original);

    // Update modified date and size
    const updated = {
      ...original,
      size: 60000,
      modified_at: 1700003000000,
      content_fingerprint: 'hash2'
    };
    fileDao.upsertFile(db, updated);

    const count = db.prepare('SELECT COUNT(*) as count FROM files WHERE path = ?').get(original.path).count;
    expect(count).toBe(1);

    const current = fileDao.getFileByPath(db, original.path);
    expect(current.size).toBe(60000);
    expect(current.content_fingerprint).toBe('hash2');
  });

  it('indexes document content and searches via SQLite FTS5', () => {
    const file = {
      name: 'ResearchPaper.pdf',
      path: 'C:\\Users\\Test\\Documents\\ResearchPaper.pdf',
      type: 'file',
      extension: '.pdf',
      category: 'documents',
      size: 100000,
      created_at: 1700000000000,
      modified_at: 1700001000000,
      indexed_at: 1700002000000,
      content_status: 'pending',
      content_fingerprint: null
    };
    const { lastInsertRowid: fileId } = fileDao.upsertFile(db, file);

    const contentPage1 = 'Seekly is an ultra fast desktop search application for Windows.';
    const contentPage2 = 'It supports advanced full-text indexing using SQLite FTS5 and BM25 ranking.';

    fileDao.insertDocumentContent(db, fileId, 1, contentPage1, file.name);
    fileDao.insertDocumentContent(db, fileId, 2, contentPage2, file.name);
    fileDao.updateContentStatus(db, fileId, 'indexed', 'hash123');

    // FTS5 query
    const ftsResults = db.prepare(`
      SELECT file_id, page_number, snippet(document_content_fts, 3, '<mark>', '</mark>', '...', 15) as snippet
      FROM document_content_fts
      WHERE document_content_fts MATCH 'FTS5'
    `).all();

    expect(ftsResults.length).toBe(1);
    expect(ftsResults[0].page_number).toBe(2);
    expect(ftsResults[0].snippet).toContain('<mark>FTS5</mark>');
  });

  it('cascades deletion of document content and FTS records when file is deleted', () => {
    const file = {
      name: 'Notes.txt',
      path: 'C:\\Users\\Test\\Desktop\\Notes.txt',
      type: 'file',
      extension: '.txt',
      category: 'documents',
      size: 500,
      created_at: 1700000000000,
      modified_at: 1700001000000,
      indexed_at: 1700002000000,
      content_status: 'indexed',
      content_fingerprint: 'txt1'
    };
    const { lastInsertRowid: fileId } = fileDao.upsertFile(db, file);
    fileDao.insertDocumentContent(db, fileId, null, 'Confidential secret password list', file.name);

    expect(db.prepare('SELECT COUNT(*) as count FROM document_content WHERE file_id = ?').get(fileId).count).toBe(1);
    expect(db.prepare("SELECT COUNT(*) as count FROM document_content_fts WHERE document_content_fts MATCH 'Confidential'").get().count).toBe(1);

    // Delete file
    fileDao.deleteFileByPath(db, file.path);

    expect(fileDao.getFileByPath(db, file.path)).toBeUndefined();
    expect(db.prepare('SELECT COUNT(*) as count FROM document_content WHERE file_id = ?').get(fileId).count).toBe(0);
    expect(db.prepare("SELECT COUNT(*) as count FROM document_content_fts WHERE document_content_fts MATCH 'Confidential'").get().count).toBe(0);
  });

  it('computes accurate index stats', () => {
    fileDao.upsertFile(db, {
      name: 'photo.png',
      path: 'C:\\Users\\Test\\Downloads\\photo.png',
      type: 'file',
      extension: '.png',
      category: 'images',
      size: 2000,
      created_at: 1,
      modified_at: 1,
      indexed_at: 1,
      content_status: 'skipped',
      content_fingerprint: null
    });

    fileDao.upsertFile(db, {
      name: 'doc.pdf',
      path: 'C:\\Users\\Test\\Documents\\doc.pdf',
      type: 'file',
      extension: '.pdf',
      category: 'documents',
      size: 5000,
      created_at: 1,
      modified_at: 1,
      indexed_at: 1,
      content_status: 'failed',
      content_fingerprint: null
    });

    const stats = fileDao.getStats(db);
    expect(stats.totalFiles).toBe(2);
    expect(stats.totalDocuments).toBe(1);
    expect(stats.failedDocuments).toBe(1);
    expect(stats.extractedDocuments).toBe(0);
  });
});
