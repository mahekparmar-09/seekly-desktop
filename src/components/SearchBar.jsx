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
    <div className="search-bar-shell">
      <div className="search-icon-slot">
        <Search size={18} className="search-field-icon" />
      </div>

      <input
        ref={ref}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search files, apps, folders or document text..."
        className="search-field-input"
        autoFocus
        spellCheck={false}
      />

      <div className="search-tools-slot no-drag">
        {query && (
          <button
            type="button"
            onClick={onClear}
            className="search-tool-btn clear-btn"
            title="Clear search (Esc)"
          >
            <X size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={toggleFilterPanel}
          className={`search-tool-btn filter-toggle-btn ${isFilterActive ? 'active' : ''}`}
          title="Toggle advanced filters"
        >
          <SlidersHorizontal size={16} />
          {isFilterActive && <span className="filter-active-dot" />}
        </button>
      </div>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
