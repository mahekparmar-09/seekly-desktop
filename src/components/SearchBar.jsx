import React, { forwardRef } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

const SearchBar = forwardRef(({
  query,
  setQuery,
  onClear,
  isFilterActive,
  toggleFilterPanel,
  onKeyDown
}, ref) => {
  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <Search className="search-icon" size={20} />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search files, applications, or document content..."
          className="search-input"
          autoFocus
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            className="clear-btn"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={toggleFilterPanel}
          className={`filter-toggle-btn ${isFilterActive ? 'active' : ''}`}
          title="Toggle advanced filters"
        >
          <SlidersHorizontal size={18} />
          {isFilterActive && <span className="filter-badge-dot" />}
        </button>
      </div>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
