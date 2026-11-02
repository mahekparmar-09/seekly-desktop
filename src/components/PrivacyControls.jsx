import React, { useState } from 'react';
import { Shield, FolderPlus, Trash2, RefreshCw, Lock, HardDrive, Folder } from 'lucide-react';
import IndexingStatus from './IndexingStatus';

export default function PrivacyControls({
  excludedFolders = [],
  onAddExclusion,
  onRemoveExclusion,
  onRebuildIndex,
  indexingStatus,
  onPauseIndexing,
  onResumeIndexing
}) {
  const [isRebuilding, setIsRebuilding] = useState(false);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      await onRebuildIndex();
    } finally {
      setTimeout(() => setIsRebuilding(false), 2000);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header-row">
        <div className="page-header-title">
          <Shield size={16} className="text-secondary-accent" />
          <span>Settings & Privacy</span>
        </div>
      </div>

      {/* Privacy Manifesto Card */}
      <div className="fluent-panel privacy-banner">
        <div className="privacy-banner-left">
          <div className="privacy-shield-icon">
            <Lock size={18} className="text-secondary-accent" />
          </div>
          <div className="privacy-banner-content">
            <div className="privacy-banner-title">
              <span>100% Local & Private Search Engine</span>
              <span className="badge badge-success">Local Only</span>
            </div>
            <p className="privacy-banner-text">
              Seekly operates strictly on your local Windows PC. Your file names, folder paths, document contents, and search queries never leave your device.
            </p>
          </div>
        </div>
      </div>

      {/* Indexing Status & Controls */}
      {indexingStatus && (
        <IndexingStatus
          status={indexingStatus}
          onPause={onPauseIndexing}
          onResume={onResumeIndexing}
          onRebuild={handleRebuild}
        />
      )}

      {/* Excluded Folders Section */}
      <div className="fluent-panel">
        <div className="panel-header-row">
          <div className="panel-title-group">
            <Shield size={15} className="text-secondary-accent" />
            <span className="panel-title-text">Excluded Folders</span>
            {excludedFolders.length > 0 && (
              <span className="badge badge-neutral">{excludedFolders.length}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onAddExclusion}
            className="fluent-btn-primary"
            title="Browse folder to exclude from indexing"
          >
            <FolderPlus size={14} />
            <span>Add Folder Exclusion</span>
          </button>
        </div>

        <p className="panel-subtitle-text">
          Paths in this list are completely ignored during indexing and will never appear in search results.
        </p>

        <div className="exclusions-container">
          {excludedFolders.length === 0 ? (
            <div className="exclusions-empty-state">
              <span>No custom exclusions configured. All standard user directories are indexed.</span>
            </div>
          ) : (
            excludedFolders.map((item) => (
              <div key={item.id} className="exclusion-row">
                <div className="exclusion-path-wrap">
                  <Folder size={14} className="text-amber" />
                  <span className="exclusion-path-text" title={item.folder_path}>
                    {item.folder_path}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveExclusion(item.folder_path)}
                  className="exclusion-delete-btn"
                  title="Remove exclusion and re-allow indexing"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Maintenance & Rebuild Section */}
      <div className="fluent-panel">
        <div className="panel-header-row">
          <div className="panel-title-group">
            <HardDrive size={15} className="text-secondary-accent" />
            <span className="panel-title-text">Index Maintenance</span>
          </div>
          <button
            type="button"
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="fluent-btn-secondary"
            title="Wipe and rebuild all search metadata and full-text indexes"
          >
            <RefreshCw size={13} className={isRebuilding ? 'spin' : ''} />
            <span>{isRebuilding ? 'Rebuilding Index...' : 'Rebuild Index'}</span>
          </button>
        </div>
        <p className="panel-subtitle-text">
          Reconstruct the entire SQLite metadata catalog and FTS5 full-text database from scratch. Useful after modifying exclusions or adding large directory trees.
        </p>
      </div>
    </div>
  );
}
