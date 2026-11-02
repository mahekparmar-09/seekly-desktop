# Contributing to Seekly

Thank you for your interest in contributing to Seekly! Seekly is a local-first Windows desktop search launcher designed to be fast, keyboard-driven, and completely private.

## Getting Started

### Prerequisites

- **Windows 10** or **Windows 11** (64-bit)
- **Node.js** v20+ or v22+
- **npm** v10+
- **Git**

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/seekly-desktop.git
   cd seekly-desktop
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild native SQLite module for Electron:**
   ```bash
   npm run rebuild
   ```

4. **Launch development mode:**
   ```bash
   npm run dev
   ```

## Development Guidelines

- **Zero Cloud / Telemetry:** Seekly is strictly 100% offline. Do not add external network requests, telemetry, or cloud dependencies.
- **Security & Sandboxing:** Keep `contextIsolation: true` and `nodeIntegration: false`. All communication between the frontend and main process must go through validated, typed IPC channels in `electron/preload.cjs`.
- **Testing:** Add or update unit/integration tests in the `tests/` directory for any new logic or bug fixes. Run the complete test suite with `npm test`. All tests must pass before submitting a PR.
- **Performance:** Keep document extraction and filesystem operations asynchronous. Never block the main or UI thread.

## Pull Request Process

1. Create a descriptive branch: `git checkout -b feature/your-feature-name` or `git checkout -b fix/issue-name`.
2. Commit your changes using clear, conventional commit messages:
   - `feat: add ocr support for scanned pdfs`
   - `fix: prevent race condition in document extraction queue`
   - `docs: update installer instructions`
3. Ensure all tests pass: `npm test`.
4. Ensure the renderer builds without errors: `npm run build:renderer`.
5. Push to your fork and submit a Pull Request against the `main` branch.

## Code of Conduct

Please be respectful, collaborative, and constructive when engaging with other contributors.

