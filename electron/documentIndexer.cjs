const fs = require('fs');
const path = require('path');
const { fileDao, getDatabase } = require('./database.cjs');

// Maximum file size for content extraction: 25 MB
const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

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
   * Extract text from PDF with page preservation
   */
  async extractPdf(filePath) {
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.promises.readFile(filePath);

    const pages = [];
    let currentPage = 1;

    // Custom pagerender callback to capture text per page
    const renderPage = (pageData) => {
      return pageData.getTextContent().then((textContent) => {
        let text = '';
        let lastY = null;
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        const pageNum = pageData.pageIndex ? pageData.pageIndex + 1 : currentPage;
        currentPage++;
        if (text.trim()) {
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
   * Extract text from TXT with encoding safety
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
    return [{ pageNumber: null, text: content }];
  }

  /**
   * Extract text from a single file based on its extension
   */
  async extractFile(filePath, extension) {
    const ext = extension.toLowerCase();
    switch (ext) {
      case '.pdf':
        return await this.extractPdf(filePath);
      case '.docx':
        return await this.extractDocx(filePath);
      case '.txt':
        return await this.extractTxt(filePath);
      default:
        throw new Error(`Unsupported document extension: ${ext}`);
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

            const pages = await this.extractFile(file.path, file.extension);
            const fingerprint = `${file.size}_${file.modified_at}`;

            if (pages.length > 0) {
              for (const page of pages) {
                fileDao.insertDocumentContent(db, file.id, page.pageNumber, page.text, file.name);
              }
              fileDao.updateContentStatus(db, file.id, 'indexed', fingerprint);
            } else {
              // File is empty or scanned image PDF
              fileDao.updateContentStatus(db, file.id, 'unsupported', fingerprint);
            }
          } catch (err) {
            console.warn(`[DocumentIndexer] Extraction error for ${file.path}:`, err.message);
            fileDao.updateContentStatus(db, file.id, 'failed', `err_${Date.now()}`);
          }

          // Small delay to ensure zero UI lag
          await new Promise((r) => setTimeout(r, 30));
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
