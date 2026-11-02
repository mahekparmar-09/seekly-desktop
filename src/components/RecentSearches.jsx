import React from 'react';
import { Clock, X, Trash2, ArrowUpRight, Search, Layers, FileText, AlignLeft } from 'lucide-react';

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RecentSearches({
  searches = [],
  onSelectSearch,
  onDeleteSearch,
  onClearAll,
  compact = false
}) {
  if (!searches || searches.length === 0) {
    if (compact) return null;
    return (
      <div className="empty-substate">
        <div className="empty-icon-ring">
          <Clock size={28} className="text-secondary-accent" />
        </div>
        <p className="empty-substate-title">No search history yet</p>
        <span className="empty-substate-desc">
          Your previous queries will be recorded here so you can re-run them with a single click.
        </span>
      </div>
    );
  }

  // ── Compact View: rendered under empty search bar ──
  if (compact) {
    return (
      <div className="recent-searches-box compact">
        <div className="recent-searches-header">
          <div className="recent-header-title">
            <Clock size={13} className="text-secondary-accent" />
            <span>Recent Searches</span>
          </div>
          <button
            type="button"
            onClick={onClearAll}
            className="recent-clear-action"
            title="Clear recent searches"
          >
            <Trash2 size={11} />
            <span>Clear</span>
          </button>
        </div>

        <div className="recent-chips-container">
          {searches.slice(0, 8).map((item) => (
            <div
              key={item.id}
              className="recent-chip"
              onClick={() => onSelectSearch(item.query, item.search_mode)}
              title={`Search "${item.query}" (${item.search_mode || 'both'} mode)`}
            >
              <Clock size={11} className="recent-chip-clock" />
              <span className="recent-chip-text">{item.query}</span>
              {item.search_mode && item.search_mode !== 'both' && (
                <span className="recent-chip-mode">{item.search_mode}</span>
              )}
              <button
                type="button"
                className="recent-chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSearch(item.id);
                }}
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Full Page View: rendered in History tab ──
  return (
    <div className="history-page">
      <div className="page-header-row">
        <div className="page-header-title">
          <Clock size={16} className="text-secondary-accent" />
          <span>Search History</span>
          <span className="page-header-badge">{searches.length}</span>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          className="fluent-btn-danger"
          title="Clear entire search history"
        >
          <Trash2 size={13} />
          <span>Clear All History</span>
        </button>
      </div>

      <div className="history-list-container">
        {searches.map((item) => {
          const mode = item.search_mode || 'both';
          const ModeIcon = mode === 'content' ? AlignLeft : (mode === 'filename' ? FileText : Layers);

          return (
            <div
              key={item.id}
              className="history-item-card"
              onClick={() => onSelectSearch(item.query, item.search_mode)}
            >
              <div className="history-item-left">
                <div className="history-icon-box">
                  <Search size={15} className="text-secondary-accent" />
                </div>
                <div className="history-text-col">
                  <span className="history-query-text">{item.query}</span>
                  <div className="history-meta-row">
                    <span className="history-mode-pill">
                      <ModeIcon size={10} />
                      <span>{mode.toUpperCase()}</span>
                    </span>
                    {item.searched_at && (
                      <span className="history-time-text">
                        {formatTimestamp(item.searched_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="history-item-actions no-drag">
                <button
                  type="button"
                  className="history-action-btn run-search"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSearch(item.query, item.search_mode);
                  }}
                  title="Run this search"
                >
                  <ArrowUpRight size={13} />
                  <span>Search</span>
                </button>

                <button
                  type="button"
                  className="history-action-btn delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSearch(item.id);
                  }}
                  title="Delete from history"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
