import React from 'react';
import { Search, FileSearch, Sparkles } from 'lucide-react';

export default function EmptyState({ type = 'initial', query = '' }) {
  if (type === 'no-results') {
    return (
      <div className="empty-state">
        <FileSearch size={40} className="empty-icon text-muted" />
        <h4 className="empty-title">No matches found for "{query}"</h4>
        <p className="empty-subtitle">
          Try adjusting your query, switching to "Both" mode, or resetting active filters.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-badge">
        <Sparkles size={16} className="text-teal" />
        <span>Press <kbd>Ctrl</kbd> + <kbd>Space</kbd> anytime</span>
      </div>
      <h3 className="empty-title">Ready to search</h3>
      <p className="empty-subtitle">
        Type to instantly locate local files, applications, or full text inside PDF, DOCX, and TXT documents.
      </p>
    </div>
  );
}
