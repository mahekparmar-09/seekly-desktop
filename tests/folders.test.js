import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initDatabase, closeDatabase, fileDao } = require('../electron/database.cjs');
const { Indexer } = require('../electron/indexer.cjs');
const { search } = require('../electron/search.cjs');

describe('Folder Search and OneDrive Discovery Tests', () => {
  let testDbPath;
  let db;
  let tempDir;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `seekly_folders_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    db = initDatabase(testDbPath);

    tempDir = path.join(os.tmpdir(), `seekly_folders_ws_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create folders
    const portfolioDir = path.join(tempDir, 'Portfolio');
    const sdacDir = path.join(tempDir, 'sdac');
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const nestedInNodeModules = path.join(nodeModulesDir, 'some_package');

    fs.mkdirSync(portfolioDir, { recursive: true });
    fs.mkdirSync(sdacDir, { recursive: true });
    fs.mkdirSync(nestedInNodeModules, { recursive: true });

    // Inside portfolio, create files
    fs.writeFileSync(path.join(portfolioDir, 'index.html'), '<h1>My Portfolio</h1>');
    fs.writeFileSync(path.join(portfolioDir, 'resume.pdf'), 'Resume of SDAC graduate');

    // Inside node_modules, create files that should be ignored
    fs.writeFileSync(path.join(nestedInNodeModules, 'index.js'), 'module.exports = {};');
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_e) {}
  });

  it('indexes folders with real timestamps and ignores node_modules', async () => {
    const indexer = new Indexer(db);
    const items = await indexer.scanDirectory(tempDir, false, []);

    const names = items.map(i => i.name);
    expect(names).toContain('Portfolio');
    expect(names).toContain('sdac');
    expect(names).not.toContain('node_modules');
    expect(names).not.toContain('some_package');

    const portfolioItem = items.find(i => i.name === 'Portfolio');
    expect(portfolioItem.type).toBe('folder');
    expect(portfolioItem.category).toBe('folders');
    expect(portfolioItem.modified_at).toBeGreaterThan(0);
  });

  it('indexes the root location itself as a folder', async () => {
    const indexer = new Indexer(db);
    await indexer.startIndexing({
      locations: [{ path: tempDir, type: 'folder' }]
    });

    const rootFolder = fileDao.getFileByPath(db, tempDir);
    expect(rootFolder).toBeDefined();
    expect(rootFolder.type).toBe('folder');
    expect(rootFolder.name).toBe(path.basename(tempDir));
  });

  it('finds folders when searching for folder name', async () => {
    const indexer = new Indexer(db);
    await indexer.startIndexing({
      locations: [{ path: tempDir, type: 'folder' }]
    });

    const res = search('sdac', { mode: 'both', fileType: 'all' }, db);
    expect(res.results.length).toBeGreaterThanOrEqual(1);
    const sdacFolder = res.results.find(r => r.name === 'sdac');
    expect(sdacFolder).toBeDefined();
    expect(sdacFolder.type).toBe('folder');

    const resPort = search('Portfolio', { mode: 'both', fileType: 'folders' }, db);
    expect(resPort.results.length).toBeGreaterThanOrEqual(1);
    expect(resPort.results[0].name).toBe('Portfolio');
    expect(resPort.results[0].type).toBe('folder');
  });

  it('strictly returns only folders when fileType is folders or category is folders', async () => {
    const indexer = new Indexer(db);
    await indexer.startIndexing({
      locations: [{ path: tempDir, type: 'folder' }]
    });

    // Insert searchable content into resume.pdf
    const resumeFile = fileDao.getFileByPath(db, path.join(tempDir, 'Portfolio', 'resume.pdf'));
    if (resumeFile) {
      fileDao.insertDocumentContent(db, resumeFile.id, 1, 'SDAC certification and details', 'resume.pdf');
    }

    // Searching 'sdac' with fileType: 'folders' should ONLY return the folder, NOT resume.pdf!
    const folderFilterRes = search('sdac', { mode: 'both', fileType: 'folders' }, db);
    expect(folderFilterRes.results.every(r => r.type === 'folder')).toBe(true);
    expect(folderFilterRes.results.some(r => r.name === 'sdac')).toBe(true);
    expect(folderFilterRes.results.some(r => r.name === 'resume.pdf')).toBe(false);

    // Searching with category: 'folders' should also ONLY return folders
    const catFilterRes = search('sdac', { mode: 'both', category: 'folders' }, db);
    expect(catFilterRes.results.every(r => r.type === 'folder')).toBe(true);
  });

  it('discovers OneDrive desktop and documents in default locations if present', () => {
    const indexer = new Indexer(db);
    const locations = indexer.getDefaultLocations();
    const locPaths = locations.map(l => l.path.toLowerCase());

    const home = os.homedir().toLowerCase();
    const oneDrive = (process.env.OneDrive || '').toLowerCase();

    if (oneDrive && fs.existsSync(path.join(oneDrive, 'Desktop'))) {
      expect(locPaths).toContain(path.join(oneDrive, 'desktop').toLowerCase());
    } else {
      expect(locPaths).toContain(path.join(home, 'desktop').toLowerCase());
    }
  });
});

