import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Search,
  Star,
  Clock,
  Settings as SettingsIcon,
  Info,
  Layers,
  FileText,
  Folder,
  AppWindow,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  FileCode,
  FileSpreadsheet
} from 'lucide-react';

import SearchBar from './components/SearchBar';
import SearchModeSelector from './components/SearchModeSelector';
import FilterPanel from './components/FilterPanel';
import SearchResults from './components/SearchResults';
import RecentSearches from './components/RecentSearches';
import FavoriteFiles from './components/FavoriteFiles';
import PrivacyControls from './components/PrivacyControls';
import AboutView from './components/AboutView';
import EmptyState from './components/EmptyState';
import SeeklyLogo from './components/SeeklyLogo';

const QUICK_FILTERS = [
  { id: 'all', label: 'All', icon: Layers, colorClass: 'text-primary-blue' },
  { id: 'pdf', label: 'PDF', icon: FileText, colorClass: 'text-red' },
  { id: 'docx', label: 'DOCX', icon: FileText, colorClass: 'text-blue' },
  { id: 'txt', label: 'TXT', icon: FileText, colorClass: 'text-muted' },
  { id: 'images', label: 'Images', icon: ImageIcon, colorClass: 'text-cyan' },
  { id: 'apps', label: 'Apps', icon: AppWindow, colorClass: 'text-purple' },
  { id: 'folders', label: 'Folders', icon: Folder, colorClass: 'text-amber' }
];

const DEFAULT_FILTERS = {
  dateRange: 'any',
  sizeRange: 'any',
  category: 'all',
  location: 'all',
  sortBy: 'relevance'
};

export default function App() {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState('both');
  const [quickFilter, setQuickFilter] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_FILTERS);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'favorites' | 'history' | 'settings' | 'about'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [excludedFolders, setExcludedFolders] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const [indexingStatus, setIndexingStatus] = useState({
    status: 'Ready',
    totalFiles: 0,
    totalDocuments: 0,
    extractedDocuments: 0,
    failedDocuments: 0,
    progress: 100,
    isPaused: false
  });

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const reloadAuxiliaryData = useCallback(() => {
    if (window.seeklyAPI) {
      window.seeklyAPI.getRecentSearches?.().then(setRecentSearches).catch(console.error);
      window.seeklyAPI.getFavorites?.().then(setFavorites).catch(console.error);
      window.seeklyAPI.getExcludedFolders?.().then(setExcludedFolders).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (searchInputRef.current && activeTab === 'search') {
      searchInputRef.current.focus();
    }

    if (window.seeklyAPI) {
      window.seeklyAPI.getIndexingStatus?.().then((st) => {
        if (st) setIndexingStatus(st);
      }).catch(console.error);

      window.seeklyAPI.isMaximized?.().then((max) => {
        setIsMaximized(!!max);
      }).catch(() => { });

      reloadAuxiliaryData();

      const unsubIndex = window.seeklyAPI.onIndexingUpdate?.((update) => {
        if (update) setIndexingStatus(update);
      });

      const unsubShown = window.seeklyAPI.onWindowShown?.(() => {
        if (searchInputRef.current && activeTab === 'search') {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        reloadAuxiliaryData();
      });

      const unsubMax = window.seeklyAPI.onWindowMaximized?.((isMax) => {
        setIsMaximized(isMax);
      });

      return () => {
        if (typeof unsubIndex === 'function') unsubIndex();
        if (typeof unsubShown === 'function') unsubShown();
        if (typeof unsubMax === 'function') unsubMax();
      };
    }
  }, [reloadAuxiliaryData, activeTab]);

  // Debounced search logic (150ms for snappy responsiveness via worker thread)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    const hasFilter = quickFilter !== 'all'
      || advancedFilters.category !== 'all'
      || advancedFilters.dateRange !== 'any'
      || advancedFilters.sizeRange !== 'any'
      || advancedFilters.sortBy !== 'relevance';

    if (!trimmed && !hasFilter) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    // Require at least 2 characters when there's no active filter to avoid scanning thousands of records
    if (trimmed.length === 1 && !hasFilter && quickFilter === 'all') {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (window.seeklyAPI) {
        try {
          const resp = await window.seeklyAPI.searchFiles({
            query: trimmed,
            mode: searchMode,
            fileType: quickFilter,
            ...advancedFilters,
            limit: 40
          });
          setResults(resp?.results || []);
          setSelectedIndex(0);
        } catch (err) {
          console.error('Search error:', err);
        }
      }
    }, 180);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, searchMode, quickFilter, advancedFilters]);

  // File action handlers
  const handleOpenFile = async (filePath) => {
    if (!window.seeklyAPI) return;
    if (query.trim().length >= 2) {
      window.seeklyAPI?.recordSearch?.(query.trim(), searchMode, {
        fileType: quickFilter,
        ...advancedFilters
      });
    }
    const res = await window.seeklyAPI.openFile(filePath);
    if (!res.success) showToast(res.error || 'Failed to open file or folder', 'error');
  };

  const handleOpenFileLocation = async (filePath) => {
    if (!window.seeklyAPI) return;
    if (query.trim().length >= 2) {
      window.seeklyAPI?.recordSearch?.(query.trim(), searchMode, {
        fileType: quickFilter,
        ...advancedFilters
      });
    }
    const res = await window.seeklyAPI.openFileLocation(filePath);
    if (!res.success) showToast(res.error || 'Failed to reveal location in Explorer', 'error');
  };

  const handleToggleFavorite = async (fileId) => {
    if (!window.seeklyAPI) return;
    await window.seeklyAPI.toggleFavorite(fileId);
    reloadAuxiliaryData();
    setResults((prev) =>
      prev.map((r) => (r.id === fileId ? { ...r, is_favorite: !r.is_favorite } : r))
    );
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        if (query.trim().length >= 2) {
          window.seeklyAPI?.recordSearch?.(query.trim(), searchMode, {
            fileType: quickFilter,
            ...advancedFilters
          });
        }
        if (e.altKey) {
          handleOpenFileLocation(results[selectedIndex].path);
        } else {
          handleOpenFile(results[selectedIndex].path);
        }
      }
    } else if (e.key === 'Escape') {
      if (isFilterPanelOpen) {
        setIsFilterPanelOpen(false);
      } else if (query) {
        setQuery('');
      } else {
        window.seeklyAPI?.hideWindow?.();
      }
    }
  };

  // Privacy & Settings actions
  const handleAddExclusion = async () => {
    if (!window.seeklyAPI) return;
    const folder = await window.seeklyAPI.selectFolderDialog();
    if (folder) {
      await window.seeklyAPI.addExcludedFolder(folder);
      reloadAuxiliaryData();
      showToast(`Excluded folder: ${folder}`, 'success');
    }
  };

  const handleRemoveExclusion = async (folderPath) => {
    if (!window.seeklyAPI) return;
    await window.seeklyAPI.removeExcludedFolder(folderPath);
    reloadAuxiliaryData();
    showToast(`Removed exclusion: ${folderPath}`, 'info');
  };

  const handleRebuildIndex = async () => {
    if (!window.seeklyAPI) return;
    await window.seeklyAPI.rebuildIndex();
    showToast('Index rebuild initiated in background', 'info');
  };

  const handleMaximizeToggle = async () => {
    if (!window.seeklyAPI) return;
    const newState = await window.seeklyAPI.maximizeWindow();
    setIsMaximized(newState);
  };

  const isAnyFilterActive = isFilterPanelOpen
    || quickFilter !== 'all'
    || advancedFilters.category !== 'all'
    || advancedFilters.dateRange !== 'any'
    || advancedFilters.sizeRange !== 'any';

  const hasActiveSearch = Boolean(
    query.trim() ||
    quickFilter !== 'all' ||
    advancedFilters.category !== 'all' ||
    advancedFilters.dateRange !== 'any' ||
    advancedFilters.sizeRange !== 'any' ||
    advancedFilters.sortBy !== 'relevance'
  );

  return (
    <div className={`seekly-app-root ${isMaximized ? 'maximized' : ''}`}>
      {/* ── Top Header Bar ── */}
      <header className="fluent-header-bar">
        {/* Brand Group */}
        <div className="fluent-brand-group">
          <SeeklyLogo variant="full" size={26} showVersion={true} showTagline={true} />
        </div>

        {/* Header Right Status & Window Controls */}
        <div className="fluent-header-right">
          <div className="fluent-status-pill no-drag" title={indexingStatus.status}>
            <span className={`fluent-status-indicator ${indexingStatus.status === 'Ready' ? 'online' : 'busy'}`} />
            <span className="fluent-status-text">
              {indexingStatus.totalFiles > 0
                ? `${indexingStatus.totalFiles.toLocaleString()} files indexed`
                : 'Local search ready'}
            </span>
          </div>

          <div className="fluent-window-controls no-drag">
            <button
              type="button"
              onClick={() => window.seeklyAPI?.minimizeWindow?.()}
              className="win-btn"
              title="Minimize"
              aria-label="Minimize"
            >
              <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
                <rect width="10" height="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleMaximizeToggle}
              className="win-btn"
              title={isMaximized ? 'Restore' : 'Maximize'}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                /* Windows 11 Restore Icon: two overlapping squares */
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M2.5 2.5V0.5h7v7H7.5" />
                  <rect x="0.5" y="2.5" width="7" height="7" rx="0.5" />
                </svg>
              ) : (
                /* Windows 11 Maximize Icon: single square */
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => window.seeklyAPI?.hideWindow?.()}
              className="win-btn close"
              title="Close to tray"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M1 1l8 8M9 1l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Application Body (Sidebar + Content) ── */}
      <div className="fluent-body-layout">
        {/* Fixed Left Sidebar */}
        <aside className="fluent-sidebar no-drag">
          <nav className="fluent-nav-list">
            <button
              type="button"
              className={`fluent-nav-item ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('search');
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
            >
              <Search size={16} className="nav-icon" />
              <span className="nav-label">Search</span>
            </button>

            <button
              type="button"
              className={`fluent-nav-item ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('favorites');
                reloadAuxiliaryData();
              }}
            >
              <Star size={16} className="nav-icon" fill={favorites.length > 0 ? 'currentColor' : 'none'} />
              <span className="nav-label">Favourites</span>
              {favorites.length > 0 && (
                <span className="nav-badge">{favorites.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`fluent-nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('history');
                reloadAuxiliaryData();
              }}
            >
              <Clock size={16} className="nav-icon" />
              <span className="nav-label">History</span>
            </button>

            <button
              type="button"
              className={`fluent-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                reloadAuxiliaryData();
              }}
            >
              <SettingsIcon size={16} className="nav-icon" />
              <span className="nav-label">Settings</span>
            </button>

            <button
              type="button"
              className={`fluent-nav-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <Info size={16} className="nav-icon" />
              <span className="nav-label">About</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="fluent-main-panel">
          {toastMessage && (
            <div className={`fluent-toast toast-${toastMessage.type}`}>
              {toastMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              <span>{toastMessage.text}</span>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="search-view-layout">
              {/* Search Control Cluster */}
              <div className="search-deck">
                {/* Search Bar */}
                <div className="search-deck-top">
                  <SearchBar
                    ref={searchInputRef}
                    query={query}
                    setQuery={(q) => {
                      setQuery(q);
                      if (activeTab !== 'search') setActiveTab('search');
                    }}
                    onClear={() => setQuery('')}
                    isFilterActive={isAnyFilterActive}
                    toggleFilterPanel={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                    onKeyDown={handleKeyDown}
                  />

                  {/* Mode Selector */}
                  <SearchModeSelector
                    activeMode={searchMode}
                    onSelectMode={setSearchMode}
                  />
                </div>

                {/* File Type Filter Chips */}
                <div className="filter-chips-row no-drag">
                  {QUICK_FILTERS.map((f) => {
                    const Icon = f.icon;
                    const isSelected = quickFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`filter-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => setQuickFilter(f.id)}
                      >
                        <Icon size={12} className={`chip-glyph ${f.colorClass}`} />
                        <span>{f.label}</span>
                      </button>
                    );
                  })}

                  {/* More chips toggle */}
                  <button
                    type="button"
                    className={`filter-chip more-chip ${showMoreFilters ? 'active' : ''}`}
                    onClick={() => setShowMoreFilters(!showMoreFilters)}
                    title="Additional formats (code, sheets, audio)"
                  >
                    <MoreHorizontal size={13} className="chip-glyph text-muted" />
                    <span>More</span>
                  </button>

                  {showMoreFilters && (
                    <>
                      <button
                        type="button"
                        className={`filter-chip ${quickFilter === 'csv' ? 'active' : ''}`}
                        onClick={() => setQuickFilter('csv')}
                      >
                        <FileSpreadsheet size={12} className="chip-glyph text-teal" />
                        <span>CSV / XLS</span>
                      </button>
                      <button
                        type="button"
                        className={`filter-chip ${quickFilter === 'json' ? 'active' : ''}`}
                        onClick={() => setQuickFilter('json')}
                      >
                        <FileCode size={12} className="chip-glyph text-secondary-accent" />
                        <span>JSON</span>
                      </button>
                      <button
                        type="button"
                        className={`filter-chip ${quickFilter === 'md' ? 'active' : ''}`}
                        onClick={() => setQuickFilter('md')}
                      >
                        <FileText size={12} className="chip-glyph text-secondary" />
                        <span>Markdown</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Advanced Filters Strip */}
                {isFilterPanelOpen && (
                  <FilterPanel
                    filters={advancedFilters}
                    onChangeFilters={setAdvancedFilters}
                    onResetFilters={() => {
                      setAdvancedFilters(DEFAULT_FILTERS);
                      setQuickFilter('all');
                    }}
                    onClose={() => setIsFilterPanelOpen(false)}
                  />
                )}
              </div>

              {/* Search Results Area */}
              <div className="search-results-viewport">
                {hasActiveSearch ? (
                  results.length === 0 ? (
                    <EmptyState type="no-results" query={query} />
                  ) : (
                    <SearchResults
                      results={results}
                      selectedIndex={selectedIndex}
                      onSelectIndex={setSelectedIndex}
                      onOpen={handleOpenFile}
                      onOpenLocation={handleOpenFileLocation}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  )
                ) : (
                  <div className="search-initial-container">
                    <EmptyState type="initial" />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <FavoriteFiles
              favorites={favorites}
              onOpen={handleOpenFile}
              onOpenLocation={handleOpenFileLocation}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeTab === 'history' && (
            <RecentSearches
              searches={recentSearches}
              compact={false}
              onSelectSearch={(q, mode) => {
                setQuery(q);
                if (mode) setSearchMode(mode);
                setActiveTab('search');
              }}
              onDeleteSearch={async (id) => {
                await window.seeklyAPI?.deleteRecentSearch(id);
                reloadAuxiliaryData();
              }}
              onClearAll={async () => {
                await window.seeklyAPI?.clearRecentSearches();
                reloadAuxiliaryData();
              }}
            />
          )}

          {activeTab === 'settings' && (
            <PrivacyControls
              excludedFolders={excludedFolders}
              onAddExclusion={handleAddExclusion}
              onRemoveExclusion={handleRemoveExclusion}
              onRebuildIndex={handleRebuildIndex}
              indexingStatus={indexingStatus}
              onPauseIndexing={() => window.seeklyAPI?.pauseIndexing?.()}
              onResumeIndexing={() => window.seeklyAPI?.resumeIndexing?.()}
            />
          )}

          {activeTab === 'about' && (
            <AboutView />
          )}
        </main>
      </div>

      {/* ── Bottom Status Bar ── */}
      <footer className="fluent-footer-bar">
        <div className="footer-status-section">
          <span className={`footer-status-dot ${indexingStatus.status === 'Ready' ? 'ready' : ''}`} />
          <span className="footer-status-label">
            {indexingStatus.status === 'Ready'
              ? `${indexingStatus.totalFiles.toLocaleString()} files catalogued · ${indexingStatus.extractedDocuments.toLocaleString()} documents indexed`
              : indexingStatus.status}
          </span>
        </div>
      </footer>
    </div>
  );
}
