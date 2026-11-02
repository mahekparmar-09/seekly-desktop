import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initDatabase, closeDatabase } from '../electron/database.cjs';
import { DocumentIndexer } from '../electron/documentIndexer.cjs';
import { search, buildFtsQueries, sanitizeFtsQuery } from '../electron/search.cjs';

describe('Document Content Extraction & Search Tests', () => {
  let testDbPath;
  let testDir;
  let db;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seekly_content_test_'));
    testDbPath = path.join(testDir, 'test.db');
    db = initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch (_e) {}
    }
  });

  it('builds smart FTS queries filtering out stopwords without slow wildcards', () => {
    const q1 = buildFtsQueries('install the fingerprint library');
    expect(q1.andQuery).toContain('"install"*');
    expect(q1.andQuery).toContain('"fingerprint"*');
    expect(q1.andQuery).toContain('"library"*');
    // "the" must not be in the andQuery since substantive words are present
    expect(q1.andQuery).not.toContain('"the"');

    const q2 = buildFtsQueries('the');
    // If only stopword is present, keep it without prefix wildcard
    expect(q2.andQuery).toBe('"the"');
  });

  it('indexes text files (txt, md, json, csv) and searches their content', async () => {
    const mdPath = path.join(testDir, 'setup_guide.md');
    fs.writeFileSync(mdPath, '# Hardware Setup\n\nTo configure the raspberry pi, install the fingerprint library using pip.');

    const jsonPath = path.join(testDir, 'config.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ sensor: 'fingerprint_scanner', baudRate: 9600 }));

    // Insert file records into DB
    db.prepare(`
      INSERT INTO files (name, path, type, extension, category, size, created_at, modified_at, indexed_at, content_status)
      VALUES (?, ?, 'file', ?, 'documents', 100, 1000, 1000, 1000, 'pending')
    `).run('setup_guide.md', mdPath, '.md');

    db.prepare(`
      INSERT INTO files (name, path, type, extension, category, size, created_at, modified_at, indexed_at, content_status)
      VALUES (?, ?, 'file', ?, 'documents', 50, 1000, 1000, 1000, 'pending')
    `).run('config.json', jsonPath, '.json');

    const indexer = new DocumentIndexer(db);
    await indexer.processPendingDocuments();

    // Verify both are indexed
    const indexedCount = db.prepare("SELECT count(*) as c FROM files WHERE content_status = 'indexed'").get()?.c;
    expect(indexedCount).toBe(2);

    // Search query with stopwords: "install the fingerprint library"
    const searchRes = search('install the fingerprint library', { mode: 'content' }, db);
    expect(searchRes.results.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.results[0].name).toBe('setup_guide.md');
    expect(searchRes.results[0].snippet).toContain('fingerprint');

    // Search JSON content
    const jsonSearch = search('baudRate 9600', { mode: 'content' }, db);
    expect(jsonSearch.results.length).toBeGreaterThanOrEqual(1);
    expect(jsonSearch.results[0].name).toBe('config.json');
  });

  it('searches in "both" mode and ranks content matches appropriately', async () => {
    const docPath = path.join(testDir, 'notes.txt');
    fs.writeFileSync(docPath, 'Important meeting regarding the quarterly budget and financial forecasting.');

    db.prepare(`
      INSERT INTO files (name, path, type, extension, category, size, created_at, modified_at, indexed_at, content_status)
      VALUES (?, ?, 'file', '.txt', 'documents', 100, 1000, 1000, 1000, 'pending')
    `).run('notes.txt', docPath);

    const indexer = new DocumentIndexer(db);
    await indexer.processPendingDocuments();

    const results = search('quarterly budget', { mode: 'both' }, db);
    expect(results.results.length).toBe(1);
    expect(results.results[0].name).toBe('notes.txt');
    expect(['content', 'both']).toContain(results.results[0].matchType);
    expect(results.results[0].snippet).toContain('budget');
  });
});
