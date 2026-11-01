import React from 'react';
import { Calendar, HardDrive, Folder, ArrowUpDown, X, RotateCcw } from 'lucide-react';

export default function FilterPanel({
  filters,
  onChangeFilters,
  onResetFilters,
  onClose
}) {
  const update = (key, val) => {
    onChangeFilters({ ...filters, [key]: val });
  };

  return (
    <div className="filter-panel-overlay">
      <div className="filter-panel-card">
        <div className="filter-panel-header">
          <div className="filter-panel-title">
            <span className="font-semibold text-primary">Advanced Search Filters</span>
          </div>
          <div className="filter-panel-header-actions">
            <button
              type="button"
              onClick={onResetFilters}
              className="filter-reset-btn"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="filter-close-btn"
              title="Close panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="filter-panel-grid">
          {/* Modified Date */}
          <div className="filter-group">
            <label className="filter-label">
              <Calendar size={13} className="text-teal" />
              <span>Modified Date</span>
            </label>
            <select
              value={filters.dateRange || 'any'}
              onChange={(e) => update('dateRange', e.target.value)}
              className="filter-select"
            >
              <option value="any">Any time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
            </select>
          </div>

          {/* File Size */}
          <div className="filter-group">
            <label className="filter-label">
              <HardDrive size={13} className="text-teal" />
              <span>File Size</span>
            </label>
            <select
              value={filters.sizeRange || 'any'}
              onChange={(e) => update('sizeRange', e.target.value)}
              className="filter-select"
            >
              <option value="any">Any size</option>
              <option value="<1MB">Below 1 MB</option>
              <option value="1-10MB">1 MB – 10 MB</option>
              <option value="10-100MB">10 MB – 100 MB</option>
              <option value=">100MB">Above 100 MB</option>
            </select>
          </div>

          {/* Category */}
          <div className="filter-group">
            <label className="filter-label">
              <Folder size={13} className="text-teal" />
              <span>Category</span>
            </label>
            <select
              value={filters.category || 'all'}
              onChange={(e) => update('category', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              <option value="documents">Documents</option>
              <option value="images">Images</option>
              <option value="videos">Videos</option>
              <option value="audio">Audio</option>
              <option value="folders">Folders</option>
              <option value="applications">Applications</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <label className="filter-label">
              <ArrowUpDown size={13} className="text-teal" />
              <span>Sort By</span>
            </label>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => update('sortBy', e.target.value)}
              className="filter-select"
            >
              <option value="relevance">Relevance</option>
              <option value="name">Name (A–Z)</option>
              <option value="modified">Modified Date</option>
              <option value="size">File Size</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
