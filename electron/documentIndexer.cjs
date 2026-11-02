const fs = require('fs');
const path = require('path');
const { fileDao, getDatabase } = require('./database.cjs');

// Maximum file size for content extraction: 12 MB
const MAX_DOCUMENT_SIZE_BYTES = 12 * 1024 * 1024;
// Maximum pages to extract per PDF for snappy indexing
const MAX_PDF_PAGES = 30;

class DocumentIndexer {
  constructor(db = null) {
    this.db = db;
    this.isProcessing = false;
    this.isPaused = false;
    this.cancelRequested = false;
    this.onUpdateCallback = null;
  }

  getDb() {
    return this.db || getDatabase();
  }

  setUpdateCallback(cb) {
    this.onUpdateCallback = cb;
  }

  emitUpdate(customStatus = {}) {
    if (this.onUpdateCallback) {
      const db = this.getDb();
      const stats = fileDao.getStats(db);
      this.onUpdateCallback({
        ...stats,
        isPaused: this.isPaused,
        ...customStatus
      });
    }
  }

  /**
   * Extract text from PDF with page preservation and intelligent spacing
   */
  async extractPdf(filePath) {
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.promises.readFile(filePath);

    const pages = [];
    let currentPage = 1;

    // Custom pagerender callback to capture text per page with gap detection
    const renderPage = (pageData) => {
      if (pages.length >= MAX_PDF_PAGES) {
        return Promise.resolve('');
      }

      return pageData.getTextContent().then((textContent) => {
        let text = '';
        let lastX = null;
        let lastY = null;
        let lastW = null;

        for (const item of textContent.items) {
          const x = item.transform[4];
          const y = item.transform[5];
          const w = item.width || 0;
          const str = item.str || '';

          if (!str && !item.hasEOL) continue;

          // Vertical displacement > 2.5 points indicates a newline
          if (lastY !== null && Math.abs(y - lastY) > 2.5) {
            if (!text.endsWith('\n')) text += '\n';
          } else if (lastX !== null && lastW !== null && x > (lastX + lastW + 1.2)) {
            // Horizontal gap between items indicates a space
            if (!text.endsWith(' ') && !text.endsWith('\n')) text += ' ';
          }

          text += str;
          if (item.hasEOL && !text.endsWith('\n')) {
            text += '\n';
          }

          lastX = x;
          lastY = y;
          lastW = w;
        }

        const pageNum = pageData.pageIndex !== undefined ? pageData.pageIndex + 1 : currentPage;
        currentPage++;
        if (text.trim() && pages.length < MAX_PDF_PAGES) {
          pages.push({ pageNumber: pageNum, text: text.trim() });
        }
        return text;
      });
    };

    const parsed = await pdfParse(dataBuffer, { pagerender: renderPage });

    // Fallback: if pagerender didn't populate pages, use overall parsed text
    if (pages.length === 0 && parsed.text && parsed.text.trim()) {
      pages.push({ pageNumber: 1, text: parsed.text.trim() });
    }

    return pages;
  }

  /**
   * Extract text from DOCX using Mammoth
   */
  async extractDocx(filePath) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    const text = (result.value || '').trim();
    if (!text) return [];
    return [{ pageNumber: null, text }];
  }

  /**
   * Extract text from legacy DOC format
   */
  async extractDoc(filePath) {
    // 1. Try mammoth first
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = (result.value || '').trim();
      if (text) return [{ pageNumber: null, text }];
    } catch (_e) {}

    // 2. Binary stream extraction: look for printable ASCII text blocks
    try {
      const buffer = await fs.promises.readFile(filePath);
      const str = buffer.toString('latin1');
      const matches = str.match(/[\x20-\x7E\r\n\t]{4,}/g) || [];
      const cleaned = matches
        .filter((s) => !/^[0-9a-fA-F\s]+$/.test(s) && !/^\W+$/.test(s))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length > 30) {
        return [{ pageNumber: null, text: cleaned.slice(0, 250000) }];
      }
    } catch (_e) {}
    return [];
  }

  /**
   * Extract text from RTF documents
   */
  async extractRtf(filePath) {
    const buffer = await fs.promises.readFile(filePath);
    const content = buffer.toString('utf8');
    const cleaned = content
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\tab/g, '\t')
      .replace(/\\'[0-9a-fA-F]{2}/g, '')
      .replace(/\\[a-zA-Z]+(-?[0-9]+)? ?/g, '')
      .replace(/[{}]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
    if (!cleaned) return [];
    return [{ pageNumber: null, text: cleaned.slice(0, 250000) }];
  }

  /**
   * Extract text from HTML documents
   */
  async extractHtml(filePath) {
    const buffer = await fs.promises.readFile(filePath);
    const content = buffer.toString('utf8');
    const cleaned = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];
    return [{ pageNumber: null, text: cleaned.slice(0, 250000) }];
  }

  /**
   * Extract text from TXT, MD, CSV, JSON, LOG, XML, YAML and source files
   */
  async extractTxt(filePath) {
    const buffer = await fs.promises.readFile(filePath);

    // Strip UTF-8 BOM if present
    let content = buffer.toString('utf8');
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }
    content = content.trim();
    if (!content) return [];
    if (content.length > 250000) {
      content = content.slice(0, 250000);
    }
    return [{ pageNumber: null, text: content }];
  }

  /**
   * Extract text from a single file based on its extension
   */
  async extractFile(filePath, extension) {
    const ext = (extension || '').toLowerCase();
    switch (ext) {
      case '.pdf':
        return await this.extractPdf(filePath);
      case '.docx':
        return await this.extractDocx(filePath);
      case '.doc':
        return await this.extractDoc(filePath);
      case '.rtf':
        return await this.extractRtf(filePath);
      case '.html':
      case '.htm':
        return await this.extractHtml(filePath);
      case '.txt':
      case '.md':
      case '.markdown':
      case '.csv':
      case '.json':
      case '.log':
      case '.xml':
      case '.yaml':
      case '.yml':
      case '.ini':
      case '.env':
      case '.sql':
        return await this.extractTxt(filePath);
      default:
        throw new Error(`Unsupported document extension: ${ext}`);
    }
  }

  /**
   * Extract text with a strict timeout to prevent any document from locking the process
   */
  async extractFileWithTimeout(filePath, extension, timeoutMs = 4500) {
    const extractPromise = this.extractFile(filePath, extension);
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Extraction timed out')), timeoutMs);
    });
    try {
      return await Promise.race([extractPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Process pending documents in background
   */
  async processPendingDocuments() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.cancelRequested = false;
    const db = this.getDb();

    try {
      while (!this.cancelRequested) {
        if (this.isPaused) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        const pendingFiles = fileDao.getPendingContentFiles(db, 10);
        if (pendingFiles.length === 0) {
          break; // Done with all pending files
        }

        for (const file of pendingFiles) {
          if (this.cancelRequested) break;

          while (this.isPaused && !this.cancelRequested) {
            await new Promise((r) => setTimeout(r, 200));
          }

          this.emitUpdate({
            status: `Extracting text: ${file.name}...`,
            progress: -1
          });

          // Check if file still exists on disk
          if (!fs.existsSync(file.path)) {
            fileDao.deleteFileByPath(db, file.path);
            continue;
          }

          // Check file size safeguard
          if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
            fileDao.updateContentStatus(db, file.id, 'skipped', `size_exceeded_${file.size}`);
            continue;
          }

          try {
            // Delete previous document content if any
            fileDao.deleteDocumentContent(db, file.id);

            const pages = await this.extractFileWithTimeout(file.path, file.extension);
            const fingerprint = `${file.size}_${file.modified_at}`;

            if (pages && pages.length > 0) {
              if (typeof fileDao.insertDocumentPages === 'function') {
                fileDao.insertDocumentPages(db, file.id, pages, file.name, fingerprint);
              } else {
                for (const page of pages) {
                  fileDao.insertDocumentContent(db, file.id, page.pageNumber, page.text, file.name);
                }
                fileDao.updateContentStatus(db, file.id, 'indexed', fingerprint);
              }
            } else {
              // File is empty or scanned image PDF
              fileDao.updateContentStatus(db, file.id, 'unsupported', fingerprint);
            }
          } catch (err) {
            console.warn(`[DocumentIndexer] Extraction error for ${file.path}:`, err.message);
            fileDao.updateContentStatus(db, file.id, 'failed', `err_${Date.now()}`);
          }

          // Yield to event loop between documents to guarantee 100% responsiveness
          await new Promise((r) => setTimeout(r, 60));
        }
      }

      this.emitUpdate({ status: 'Ready', progress: 100 });
    } catch (err) {
      console.error('[DocumentIndexer] Fatal error during processing:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  cancel() {
    this.cancelRequested = true;
  }
}

let documentIndexerInstance = null;
function getDocumentIndexer(db = null) {
  if (!documentIndexerInstance) {
    documentIndexerInstance = new DocumentIndexer(db);
  }
  return documentIndexerInstance;
}

module.exports = {
  DocumentIndexer,
  getDocumentIndexer,
  MAX_DOCUMENT_SIZE_BYTES
};
