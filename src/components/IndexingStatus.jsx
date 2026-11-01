import React from 'react';
import { Database, Play, Pause, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

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

  const isIndexing = statusText.toLowerCase().includes('indexing') || statusText.toLowerCase().includes('extracting') || statusText.toLowerCase().includes('preparing');

  return (
    <div className="indexing-status-panel">
      <div className="indexing-status-header">
        <div className="indexing-status-badge">
          {isIndexing ? (
            <Loader2 size={16} className="text-teal spin" />
          ) : failedDocuments > 0 ? (
            <AlertTriangle size={16} className="text-warning" />
          ) : (
            <CheckCircle2 size={16} className="text-success" />
          )}
          <span className="indexing-status-text">{statusText}</span>
        </div>

        <div className="indexing-actions">
          {isIndexing && !isPaused && (
            <button
              type="button"
              onClick={onPause}
              className="idx-btn"
              title="Pause background indexing"
            >
              <Pause size={14} />
              <span>Pause</span>
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="idx-btn active"
              title="Resume indexing"
            >
              <Play size={14} />
              <span>Resume</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRebuild}
            className="idx-btn"
            title="Rebuild entire local index from scratch"
          >
            <RefreshCw size={14} />
            <span>Rebuild Index</span>
          </button>
        </div>
      </div>

      {isIndexing && (
        <div className="indexing-progress-bar-wrapper">
          <div
            className={`indexing-progress-bar ${progress === -1 ? 'indeterminate' : ''}`}
            style={{ width: progress >= 0 ? `${progress}%` : '50%' }}
          />
        </div>
      )}

      <div className="indexing-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Files</span>
          <span className="metric-value">{totalFiles.toLocaleString()}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Documents</span>
          <span className="metric-value">{totalDocuments.toLocaleString()}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Content Indexed</span>
          <span className="metric-value text-teal">{extractedDocuments.toLocaleString()}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Failed Extractions</span>
          <span className={`metric-value ${failedDocuments > 0 ? 'text-warning' : 'text-muted'}`}>
            {failedDocuments.toLocaleString()}
          </span>
        </div>
      </div>

      {lastIndexedAt && (
        <div className="last-indexed-footer">
          Last index update: {new Date(lastIndexedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
