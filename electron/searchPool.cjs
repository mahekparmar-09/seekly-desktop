/**
 * searchPool.cjs
 * Manages a single persistent Worker thread for SQLite search queries.
 * All queries are serialised through the worker so the main process
 * thread is never blocked — eliminating "Not Responding" freezes.
 */
'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');

let worker = null;
let workerReady = false;
let pendingQueue = []; // queued before worker is ready
const pending = new Map(); // id -> { resolve, reject, timer }
let nextId = 1;
let resolvedDbPath = null; // set by init()

const QUERY_TIMEOUT_MS = 8000; // max 8s per query before rejecting

function spawnWorker(dbPath) {
  if (!dbPath) {
    console.error('[SearchPool] Cannot spawn worker — no dbPath provided');
    return;
  }

  // Ensure the directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  worker = new Worker(path.join(__dirname, 'searchWorker.cjs'), {
    workerData: { dbPath }
  });

  worker.on('online', () => {
    workerReady = true;
    // Flush any messages that arrived while the worker was starting
    for (const msg of pendingQueue) {
      worker.postMessage(msg);
    }
    pendingQueue = [];
  });

  worker.on('message', ({ id, result, error }) => {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    if (error) {
      entry.reject(new Error(error));
    } else {
      entry.resolve(result);
    }
  });

  worker.on('error', (err) => {
    console.error('[SearchPool] Worker error:', err);
    // Reject all in-flight requests
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    pending.clear();
    workerReady = false;
    worker = null;
    // Restart after a short delay
    setTimeout(() => spawnWorker(resolvedDbPath), 2000);
  });

  worker.on('exit', (code) => {
    workerReady = false;
    worker = null;
    if (code !== 0) {
      console.warn(`[SearchPool] Worker exited with code ${code}. Restarting…`);
      setTimeout(() => spawnWorker(resolvedDbPath), 2000);
    }
  });
}

/**
 * Initialize the search worker pool.
 * Must be called once after the database path is known (after app.whenReady()).
 * @param {string} dbPath - Absolute path to the seekly.db file
 */
function initSearchPool(dbPath) {
  resolvedDbPath = dbPath;
  if (!worker) {
    spawnWorker(dbPath);
  }
}

/**
 * Run a search in the worker thread.
 * @returns {Promise<{results, total, query, mode}>}
 */
function searchInWorker(rawQuery, options = {}) {
  return new Promise((resolve, reject) => {
    // If worker isn't initialised yet, return empty results gracefully
    if (!resolvedDbPath) {
      return resolve({ results: [], total: 0, query: rawQuery, mode: options.mode || 'both' });
    }
    // Lazy-spawn if worker died
    if (!worker) {
      spawnWorker(resolvedDbPath);
    }

    const id = nextId++;
    const msg = { id, type: 'search', payload: { query: rawQuery, options } };

    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Search timed out'));
    }, QUERY_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });

    if (workerReady) {
      worker.postMessage(msg);
    } else {
      pendingQueue.push(msg);
    }
  });
}

/**
 * Terminate the worker cleanly (call on app quit).
 */
function terminateWorker() {
  if (worker) {
    try { worker.terminate(); } catch (_e) {}
    worker = null;
    workerReady = false;
  }
}

module.exports = { initSearchPool, searchInWorker, terminateWorker };
