import React, { useState } from 'react';
import { Shield, FolderPlus, Trash2, RefreshCw, CheckCircle, Lock, HardDrive } from 'lucide-react';

export default function PrivacyControls({
  excludedFolders = [],
  onAddExclusion,
  onRemoveExclusion,
  onRebuildIndex
}) {
  const [isRebuilding, setIsRebuilding] = useState(false);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      await onRebuildIndex();
    } finally {
      setTimeout(() => setIsRebuilding(false), 1500);
    }
  };

  return (
    <div className="privacy-controls-view">
      {/* Privacy Manifesto Card */}
      <div className="privacy-card">
        <div className="privacy-header">
          <div className="privacy-badge">
            <Lock size={14} className="text-teal" />
            <span>100% Local & Private</span>
          </div>
          <span className="text-dim text-xs">Zero Telemetry • No Cloud Uploads</span>
        </div>
        <p className="privacy-text">
          Seekly operates entirely on your Windows PC. Your filenames, document text, and search history
          never leave your device. All indexes are securely kept in a local SQLite database in your user profile.
        </p>
      </div>

      {/* Excluded Folders Section */}
      <div className="privacy-section">
        <div className="section-header">
          <div className="section-title">
            <Shield size={14} className="text-teal" />
            <span>Excluded Folders from Indexing</span>
          </div>
          <button
            type="button"
            onClick={onAddExclusion}
            className="action-btn-primary"
            title="Browse and select a folder to exclude from all indexing"
          >
            <FolderPlus size={14} />
            <span>Add Folder Exclusion</span>
          </button>
        </div>

        <div className="exclusions-list">
          {excludedFolders.length === 0 ? (
            <div className="empty-substate-small">
              <span className="text-muted text-xs">No folders excluded. Click above to exclude private directories.</span>
            </div>
          ) : (
            excludedFolders.map((item) => (
              <div key={item.id} className="exclusion-item">
                <span className="exclusion-path" title={item.folder_path}>{item.folder_path}</span>
                <button
                  type="button"
                  onClick={() => onRemoveExclusion(item.folder_path)}
                  className="exclusion-remove-btn"
                  title="Remove exclusion and re-allow indexing"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Index Management Section */}
      <div className="privacy-section">
        <div className="section-header">
          <div className="section-title">
            <HardDrive size={14} className="text-teal" />
            <span>Maintenance & Rebuild</span>
          </div>
          <button
            type="button"
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="action-btn-secondary"
            title="Wipe and rebuild all search metadata and full-text indexes"
          >
            <RefreshCw size={13} className={isRebuilding ? 'spin' : ''} />
            <span>{isRebuilding ? 'Rebuilding...' : 'Rebuild Entire Index'}</span>
          </button>
        </div>
        <p className="text-dim text-xs">
          If you ever suspect missing records or want a clean sweep after changing exclusions, you can rebuild the local index anytime.
        </p>
      </div>
    </div>
  );
}
