import React from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Files,
  FileText,
  CheckCheck,
  AlertOctagon
} from 'lucide-react';

export default function IndexingStatus({
  status = {},
  onPause,
  onResume,
  onRebuild
}) {
  const {
    status: statusText = 'Ready',
    totalFiles = 0,
    totalDocuments = 0,
    extractedDocuments = 0,
    failedDocuments = 0,
    lastIndexedAt,
    progress = 100,
    isPaused = false
  } = status;

  const isIndexing = statusText.toLowerCase().includes('indexing') || 
                     statusText.toLowerCase().includes('extracting') || 
                     statusText.toLowerCase().includes('preparing');

  return (
    <div className="fluent-panel indexing-panel">
      <div className="panel-header-row">
        <div className="indexing-status-indicator">
          {isIndexing ? (
            <Loader2 size={16} className="text-secondary-accent spin" />
          ) : failedDocuments > 0 ? (
            <AlertTriangle size={16} className="text-warning" />
          ) : (
            <CheckCircle2 size={16} className="text-success" />
          )}
          <span className="indexing-status-headline">{statusText}</span>
        </div>

        <div className="indexing-actions-cluster no-drag">
          {isIndexing && !isPaused && (
            <button
              type="button"
              onClick={onPause}
              className="fluent-btn-secondary"
              title="Pause background indexing"
            >
              <Pause size={13} />
              <span>Pause</span>
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="fluent-btn-primary"
              title="Resume background indexing"
            >
              <Play size={13} />
              <span>Resume</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRebuild}
            className="fluent-btn-secondary"
            title="Rebuild index from scratch"
          >
            <RefreshCw size={13} />
            <span>Rebuild</span>
          </button>
        </div>
      </div>

      {isIndexing && (
        <div className="fluent-progress-track">
          <div
            className={`fluent-progress-bar ${progress === -1 ? 'indeterminate' : ''}`}
            style={{ width: progress >= 0 ? `${progress}%` : '50%' }}
          />
        </div>
      )}

      {/* Metrics Grid */}
      <div className="metrics-four-grid">
        <div className="metric-box">
          <div className="metric-box-header">
            <Files size={13} className="text-muted" />
            <span className="metric-box-label">Files Catalogued</span>
          </div>
          <span className="metric-box-val">{totalFiles.toLocaleString()}</span>
        </div>

        <div className="metric-box">
          <div className="metric-box-header">
            <FileText size={13} className="text-muted" />
            <span className="metric-box-label">Documents Found</span>
          </div>
          <span className="metric-box-val">{totalDocuments.toLocaleString()}</span>
        </div>

        <div className="metric-box">
          <div className="metric-box-header">
            <CheckCheck size={13} className="text-secondary-accent" />
            <span className="metric-box-label">Text Extracted</span>
          </div>
          <span className="metric-box-val text-secondary-accent">{extractedDocuments.toLocaleString()}</span>
        </div>

        <div className="metric-box">
          <div className="metric-box-header">
            <AlertOctagon size={13} className={failedDocuments > 0 ? 'text-warning' : 'text-muted'} />
            <span className="metric-box-label">Extraction Errors</span>
          </div>
          <span className={`metric-box-val ${failedDocuments > 0 ? 'text-warning' : 'text-muted'}`}>
            {failedDocuments.toLocaleString()}
          </span>
        </div>
      </div>

      {lastIndexedAt && (
        <div className="indexing-footer-meta">
          <span>Catalog last synced at {new Date(lastIndexedAt).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
