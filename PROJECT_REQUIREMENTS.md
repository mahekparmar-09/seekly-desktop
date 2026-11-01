# Seekly — Project Requirements

## 1. Overview
- **Name:** Seekly
- **Platform:** Windows 10 / Windows 11
- **Type:** Desktop Search Launcher (Floating command palette / search launcher)
- **Primary Shortcut:** `Ctrl + Space` (global shortcut to summon/toggle)
- **Core Functionality:**
  - Search files by filename & folder by name
  - Search installed Windows applications (Start Menu shortcuts: `%APPDATA%\Microsoft\Windows\Start Menu\Programs` & `%ProgramData%\Microsoft\Windows\Start Menu\Programs`)
  - Search inside document contents: PDF, DOCX, TXT
  - Local SQLite with FTS5 full-text indexing
  - Advanced filters (File Type, Category, Modified Date, File Size, Location, Sorting)
  - Recent searches history (stored locally, clearable, privacy toggles)
  - Favorite files/folders
  - Actions: Open, Open File Location, Toggle Favorite
  - Privacy controls: Exclude folders, rebuild index, clear/disable history, local-only zero-telemetry
  - Background indexing management with status indicators, pause/resume, and filesystem watching (`chokidar`)
  - Modern, dark glass-inspired UI matching design spec (#030B16 background, #071A2D panel, #00D6D6 accent teal, #3478F6 accent blue, #16C79A success)

## 2. Technology Stack
- **Frontend:** React 18/19, Vite, Lucide React, Vanilla CSS design system
- **Desktop:** Electron (Secure contextIsolation: true, nodeIntegration: false, restricted preload IPC)
- **Packaging:** Electron Builder (NSIS Windows installer)
- **Database:** SQLite with FTS5
- **Document Extractors:** `pdf-parse`, `mammoth` (DOCX), safe UTF-8 filesystem reader for TXT

## 3. Stages
- Stage 1: Foundation (Electron + React + Vite, Main/Preload, Floating Frameless Window, Global Shortcut)
- Stage 2: Database (SQLite schema, migrations, FTS5 setup)
- Stage 3: Metadata Indexing (Desktop, Documents, Downloads, Start Menu shortcuts)
- Stage 4: Basic Search (Filename, folder, application search, ranking, keyboard nav)
- Stage 5: Document Content Search (PDF, DOCX, TXT text extraction, FTS5 ranking, snippet generation)
- Stage 6: Advanced Filters (Type, Category, Date, Size, Location, Sort)
- Stage 7: Productivity Features (Recent searches, Favorites, Open File Location, Privacy exclusions, Index manager, Watchers)
- Stage 8: UI Polish (Dark glass theme, animations, empty/loading states, keyboard navigation)
- Stage 9: Testing (Unit & integration test suites)
- Stage 10: GitHub and Packaging (README, LICENSE, .gitignore, electron-builder NSIS config)
