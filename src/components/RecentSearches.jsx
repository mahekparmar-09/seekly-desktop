import React from 'react';
import { Clock, X, Trash2, ArrowRight } from 'lucide-react';

export default function RecentSearches({
  searches,
  onSelectSearch,
  onDeleteSearch,
  onClearAll
}) {
  if (!searches || searches.length === 0) {
    return (
      <div className="empty-substate">
        <Clock size={32} className="text-muted" />
        <p className="text-secondary">No recent searches</p>
        <span className="text-dim text-xs">Previous search queries will appear here for fast recall.</span>
      </div>
    );
  }

  return (
    <div className="recent-searches-view">
      <div className="section-header">
        <div className="section-title">
          <Clock size={14} className="text-teal" />
          <span>Recent Searches</span>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="section-clear-btn"
          title="Clear all recent searches"
        >
          <Trash2 size={12} />
          <span>Clear History</span>
        </button>
      </div>

      <div className="recent-searches-grid">
        {searches.map((item) => (
          <div
            key={item.id}
            className="recent-search-chip"
            onClick={() => onSelectSearch(item.query, item.search_mode)}
          >
            <Clock size={12} className="text-muted" />
            <span className="chip-query">{item.query}</span>
            <span className="chip-mode-badge">{item.search_mode}</span>
            <button
              type="button"
              className="chip-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSearch(item.id);
              }}
              title="Remove this search"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
