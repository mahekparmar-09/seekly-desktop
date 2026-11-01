import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const { Indexer } = require('../electron/indexer.cjs');

describe('Metadata Indexer Tests', () => {
  let testDbPath;
  let db;
  let tempScanDir;
  let indexer;

  beforeEach(() => {
    // Unique test database
    testDbPath = path.join(os.tmpdir(), `seekly_idx_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);
    indexer = new Indexer(db);

    // Mock folder structure to index safely
    tempScanDir = path.join(os.tmpdir(), `seekly_test_dir_${Date.now()}`);
    fs.mkdirSync(tempScanDir, { recursive: true });

    // Populate mock files
    fs.writeFileSync(path.join(tempScanDir, 'AnnualReport.pdf'), 'Dummy PDF content');
    fs.writeFileSync(path.join(tempScanDir, 'MeetingNotes.docx'), 'Dummy DOCX content');
    fs.writeFileSync(path.join(tempScanDir, 'Todo.txt'), 'Task 1: Build Seekly');
    fs.writeFileSync(path.join(tempScanDir, 'hero.png'), 'binary PNG data');

    const subDir = path.join(tempScanDir, 'SubFolder');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'Presentation.pptx'), 'Slides');

    const excludedDir = path.join(tempScanDir, 'Private');
    fs.mkdirSync(excludedDir, { recursive: true });
    fs.writeFileSync(path.join(excludedDir, 'Secret.txt'), 'Secret data');
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(tempScanDir)) fs.rmSync(tempScanDir, { recursive: true, force: true });
    } catch (_e) {}
  });

  it('scans and categorizes files and folders correctly', async () => {
    const items = await indexer.scanDirectory(tempScanDir, false, []);
    
    const names = items.map(i => i.name);
    expect(names).toContain('AnnualReport.pdf');
    expect(names).toContain('MeetingNotes.docx');
    expect(names).toContain('Todo.txt');
    expect(names).toContain('hero.png');
    expect(names).toContain('SubFolder');
    expect(names).toContain('Presentation.pptx');

    // Categorization check
    const pdf = items.find(i => i.name === 'AnnualReport.pdf');
    expect(pdf.category).toBe('documents');
    expect(pdf.content_status).toBe('pending');

    const img = items.find(i => i.name === 'hero.png');
    expect(img.category).toBe('images');
    expect(img.content_status).toBe('skipped');

    const folder = items.find(i => i.name === 'SubFolder');
    expect(folder.type).toBe('folder');
    expect(folder.category).toBe('folders');
  });

  it('indexes application shortcuts and formats clean display names', async () => {
    const appsDir = path.join(tempScanDir, 'MockApps');
    fs.mkdirSync(appsDir, { recursive: true });
    fs.writeFileSync(path.join(appsDir, 'Visual Studio Code.lnk'), 'shortcut content');

    const items = await indexer.scanDirectory(appsDir, true, []);
    const appItem = items.find(i => i.name === 'Visual Studio Code');

    expect(appItem).toBeDefined();
    expect(appItem.type).toBe('app');
    expect(appItem.category).toBe('applications');
    expect(appItem.extension).toBe('.lnk');
  });

  it('strictly respects excluded folders', async () => {
    const excludedDir = path.join(tempScanDir, 'Private');
    const items = await indexer.scanDirectory(tempScanDir, false, [excludedDir]);

    const names = items.map(i => i.name);
    expect(names).not.toContain('Private');
    expect(names).not.toContain('Secret.txt');
  });

  it('runs full indexing lifecycle and populates database', async () => {
    await indexer.startIndexing({
      locations: [{ path: tempScanDir, type: 'folder' }]
    });

    const stats = fileDao.getStats(db);
    expect(stats.totalFiles).toBeGreaterThanOrEqual(5);

    const docCount = db.prepare("SELECT COUNT(*) as count FROM files WHERE category = 'documents'").get().count;
    expect(docCount).toBe(5); // PDF, DOCX, TXT, PPTX, Secret.txt
  });
});
