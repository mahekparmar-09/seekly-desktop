import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const { DocumentIndexer, MAX_DOCUMENT_SIZE_BYTES } = require('../electron/documentIndexer.cjs');

describe('Document Content Extraction & Indexing Tests', () => {
  let testDbPath;
  let db;
  let tempDocsDir;
  let docIndexer;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `seekly_doc_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);
    docIndexer = new DocumentIndexer(db);

    tempDocsDir = path.join(os.tmpdir(), `seekly_test_docs_${Date.now()}`);
    fs.mkdirSync(tempDocsDir, { recursive: true });
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(tempDocsDir)) fs.rmSync(tempDocsDir, { recursive: true, force: true });
    } catch (_e) {}
  });

  it('extracts plain text and handles UTF-8 BOM properly', async () => {
    const txtPath = path.join(tempDocsDir, 'sample_bom.txt');
    // Prepend UTF-8 BOM (0xEF, 0xBB, 0xBF)
    const bomBuffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('Confidential strategic plan for Seekly desktop engine.', 'utf8')
    ]);
    fs.writeFileSync(txtPath, bomBuffer);

    const pages = await docIndexer.extractTxt(txtPath);
    expect(pages.length).toBe(1);
    expect(pages[0].text).toBe('Confidential strategic plan for Seekly desktop engine.');
    expect(pages[0].pageNumber).toBeNull();
  });

  it('gracefully handles corrupt or unreadable files without crashing', async () => {
    const corruptPdfPath = path.join(tempDocsDir, 'corrupt.pdf');
    fs.writeFileSync(corruptPdfPath, 'NOT A REAL PDF HEADER OR CONTENT');

    const { lastInsertRowid: fileId } = fileDao.upsertFile(db, {
      name: 'corrupt.pdf',
      path: corruptPdfPath,
      type: 'file',
      extension: '.pdf',
      category: 'documents',
      size: 100,
      created_at: 1000,
      modified_at: 1000,
      indexed_at: 1000,
      content_status: 'pending',
      content_fingerprint: null
    });

    await docIndexer.processPendingDocuments();

    const file = fileDao.getFileById(db, fileId);
    expect(file.content_status).toBe('failed');
  });

  it('safeguards against extremely large files exceeding MAX_DOCUMENT_SIZE_BYTES', async () => {
    const hugeFilePath = path.join(tempDocsDir, 'huge.txt');
    fs.writeFileSync(hugeFilePath, 'small text on disk');

    // Register with simulated huge size
    const { lastInsertRowid: fileId } = fileDao.upsertFile(db, {
      name: 'huge.txt',
      path: hugeFilePath,
      type: 'file',
      extension: '.txt',
      category: 'documents',
      size: MAX_DOCUMENT_SIZE_BYTES + 5000,
      created_at: 1000,
      modified_at: 1000,
      indexed_at: 1000,
      content_status: 'pending',
      content_fingerprint: null
    });

    await docIndexer.processPendingDocuments();

    const file = fileDao.getFileById(db, fileId);
    expect(file.content_status).toBe('skipped');
    expect(file.content_fingerprint).toContain('size_exceeded');
  });

  it('processes pending files and indexes them into FTS5 table', async () => {
    const txtPath = path.join(tempDocsDir, 'notes.txt');
    fs.writeFileSync(txtPath, 'Seekly full-text search engine leverages SQLite FTS5 for lightning fast queries.');

    const stats = fs.statSync(txtPath);
    const { lastInsertRowid: fileId } = fileDao.upsertFile(db, {
      name: 'notes.txt',
      path: txtPath,
      type: 'file',
      extension: '.txt',
      category: 'documents',
      size: stats.size,
      created_at: Math.floor(stats.birthtimeMs),
      modified_at: Math.floor(stats.mtimeMs),
      indexed_at: Date.now(),
      content_status: 'pending',
      content_fingerprint: null
    });

    await docIndexer.processPendingDocuments();

    const file = fileDao.getFileById(db, fileId);
    expect(file.content_status).toBe('indexed');

    const fts = db.prepare("SELECT * FROM document_content_fts WHERE document_content_fts MATCH 'lightning'").get();
    expect(fts).toBeDefined();
    expect(fts.file_id).toBe(fileId);
  });
});
