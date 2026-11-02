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
    <div className="filter-panel-strip">
      <div className="filter-strip-inner">
        {/* Modified Date */}
        <div className="filter-strip-item">
          <label className="filter-strip-label">
            <Calendar size={12} className="text-secondary-accent" />
            <span>Date</span>
          </label>
          <select
            value={filters.dateRange || 'any'}
            onChange={(e) => update('dateRange', e.target.value)}
            className="filter-strip-select"
          >
            <option value="any">Any time</option>
            <option value="today">Today</option>
            <option value="7days">Past 7 days</option>
            <option value="30days">Past 30 days</option>
          </select>
        </div>

        {/* File Size */}
        <div className="filter-strip-item">
          <label className="filter-strip-label">
            <HardDrive size={12} className="text-secondary-accent" />
            <span>Size</span>
          </label>
          <select
            value={filters.sizeRange || 'any'}
            onChange={(e) => update('sizeRange', e.target.value)}
            className="filter-strip-select"
          >
            <option value="any">Any size</option>
            <option value="<1MB">&lt; 1 MB</option>
            <option value="1-10MB">1 – 10 MB</option>
            <option value="10-100MB">10 – 100 MB</option>
            <option value=">100MB">&gt; 100 MB</option>
          </select>
        </div>

        {/* Category */}
        <div className="filter-strip-item">
          <label className="filter-strip-label">
            <Folder size={12} className="text-secondary-accent" />
            <span>Category</span>
          </label>
          <select
            value={filters.category || 'all'}
            onChange={(e) => update('category', e.target.value)}
            className="filter-strip-select"
          >
            <option value="all">All</option>
            <option value="documents">Documents</option>
            <option value="images">Images</option>
            <option value="videos">Videos</option>
            <option value="audio">Audio</option>
            <option value="folders">Folders</option>
            <option value="applications">Applications</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="filter-strip-item">
          <label className="filter-strip-label">
            <ArrowUpDown size={12} className="text-secondary-accent" />
            <span>Sort</span>
          </label>
          <select
            value={filters.sortBy || 'relevance'}
            onChange={(e) => update('sortBy', e.target.value)}
            className="filter-strip-select"
          >
            <option value="relevance">Relevance</option>
            <option value="name">Name (A–Z)</option>
            <option value="modified">Newest first</option>
            <option value="size">Largest first</option>
          </select>
        </div>

        {/* Actions */}
        <div className="filter-strip-actions no-drag">
          <button
            type="button"
            onClick={onResetFilters}
            className="filter-strip-btn reset"
            title="Reset all filters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="filter-strip-btn close"
            title="Hide filter bar"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
