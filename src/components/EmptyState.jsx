import React from 'react';
import { Search, FileSearch, FolderSearch } from 'lucide-react';
import SeeklyLogo from './SeeklyLogo';

export default function EmptyState({ type = 'initial', query = '' }) {
  if (type === 'no-results') {
    return (
      <div className="empty-state-card">
        <div className="empty-state-icon-box">
          <FileSearch size={36} className="text-secondary-accent" />
        </div>
        <h3 className="empty-state-heading">No matches found for "{query}"</h3>
        <p className="empty-state-description">
          Check your spelling, switch to "Both" mode, or reset active file-type filters to broaden your search.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state-card initial-search">
      <div className="empty-state-icon-box pulse">
        <SeeklyLogo variant="icon" size={48} />
      </div>
      <div className="empty-state-badge">
        <span>Instant Local Search</span>
      </div>
      <h3 className="empty-state-heading">Search less. Find more.</h3>
      <p className="empty-state-description">
        Type to instantly search files, installed applications, folders, or document contents across your entire PC.
      </p>
      <div className="empty-state-shortcut-hint">
        <span>Global Hotkey:</span>
        <kbd>Ctrl</kbd> + <kbd>Space</kbd>
      </div>
    </div>
  );
}
