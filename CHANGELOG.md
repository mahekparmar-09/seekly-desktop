# Changelog

All notable changes to Seekly will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-11-02

### Added
- **Instant file search** by filename and full path across the entire Windows filesystem.
- **Deep document content search** powered by SQLite FTS5 (BM25 ranking):
  - PDF extraction with per-page text and page number citations.
  - Microsoft Word (DOCX) extraction via Mammoth.
  - Plain text (TXT, MD, CSV, JSON, LOG, XML, YAML, INI, SQL) extraction.
  - RTF and HTML extraction.
- **3 search modes:** Both, Filename-only, Content-only.
- **Quick file-type filter chips:** All, PDF, DOCX, TXT, Images, Apps, Folders, More.
- **Advanced filter panel:** Category, Modified Date, File Size, Location, Sort By.
- **Favourites (Bookmarks):** Pin files with one click; broken favourites auto-pruned.
- **Local Search History:** Recent query recall with one-click deletion or full clear.
- **Background indexer** with chokidar filesystem watcher (add, rename, modify, delete events).
- **App scanner:** Indexes installed applications from Start Menu and Program Files.
- **Global hotkeys:** `Ctrl + Space` and `Alt + Space` to summon/dismiss the launcher.
- **Privacy controls:** Exclude specific folders from indexing; excluded paths are immediately purged from the database.
- **100% offline:** No telemetry, analytics, cloud syncing, or external API calls.
- **Custom frameless window** with native Windows-style window controls (minimize, maximize, close).
- **Keyboard navigation:** Arrow keys to move selection, Enter to open, Alt+Enter to reveal in Explorer, Esc to dismiss.
- **Windows NSIS installer** produced by electron-builder.
- **41 automated tests** across 9 suites covering the database, indexer, search engine, document extraction, and filters.

### Technical
- Electron 34 with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- React 18 + Vite 6 frontend.
- SQLite 3 via `better-sqlite3`, with FTS5 full-text index and BM25 ranking.
- Async document extraction with 4.5 s per-file timeout to prevent UI freezes.
- Worker pool for parallel search queries.
- Semantic versioning from the first release.

---

*For future releases, see upcoming entries above this line.*

