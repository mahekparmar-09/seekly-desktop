# Seekly — Architecture & Technical Decisions

## 1. Project Organization
- Follow clean modular Electron + React architecture:
  - `electron/`: Main process files (`main.cjs`, `preload.cjs`, `database.cjs`, `indexer.cjs`, `documentIndexer.cjs`, `search.cjs`, `fileOpener.cjs`, `fileWatcher.cjs`, `history.cjs`, `favorites.cjs`, `privacy.cjs`, `ipcHandlers.cjs`).
  - `src/`: React frontend (`components/`, `pages/`, `App.jsx`, `main.jsx`, `index.css`).
  - `tests/`: Automated unit and integration tests.
- CommonJS (`.cjs`) for Electron main scripts to ensure zero-transpilation reliability and direct compatibility with native/Node APIs, while React frontend uses ES Modules with Vite.

## 2. Security Architecture
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` (or compatible Electron main/renderer boundary)
- Preload script uses `contextBridge.exposeInMainWorld('seeklyAPI', ...)` with strictly typed, parameter-validated IPC channels.
- Renderer never accesses `fs`, `child_process`, `shell`, or raw database instances directly.

## 3. Database Choice & FTS5
- Local SQLite database stored in `app.getPath('userData')`.
- Full-text search powered by SQLite FTS5 with custom BM25 ranking and snippet highlighting.
- Native SQLite library: `better-sqlite3` is selected for synchronous, high-throughput, FTS5-enabled local indexing and querying, rebuildable for Electron via `electron-rebuild`.

## 4. Window & Display UX
- Floating frameless window (760px x 460px), centered, always-on-top when active, rounded corners, hidden in taskbar option, toggled via `Ctrl + Space` or `Escape`.
- Graceful fallback if `Ctrl + Space` global shortcut registration fails (e.g. taken by another IME or app).

## 5. Document Processing
- Background asynchronous queue for text extraction so file scanning is instant while heavy text extraction doesn't freeze the UI.
- Safeguards: Max file size cutoff (e.g., 25MB for deep document extraction), corrupt/password-protected file error handling, page tracking for PDFs.
