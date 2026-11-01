import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  Minus, 
  X, 
  SlidersHorizontal, 
  Layers, 
  Clock, 
  Star, 
  Shield, 
  FileText, 
  Folder, 
  AppWindow, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import SearchBar from './components/SearchBar';
import SearchModeSelector from './components/SearchModeSelector';
import FilterPanel from './components/FilterPanel';
import SearchResults from './components/SearchResults';
import RecentSearches from './components/RecentSearches';
import FavoriteFiles from './components/FavoriteFiles';
import PrivacyControls from './components/PrivacyControls';
import IndexingStatus from './components/IndexingStatus';
import EmptyState from './components/EmptyState';

const QUICK_FILTERS = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'docx', label: 'DOCX', icon: FileText },
  { id: 'txt', label: 'TXT', icon: FileText },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'apps', label: 'Apps', icon: AppWindow },
  { id: 'folders', label: 'Folders', icon: Folder }
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
  const [searchMode, setSearchMode] = useState('both'); // 'both' | 'filename' | 'content'
  const [quickFilter, setQuickFilter] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_FILTERS);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'favorites' | 'history' | 'privacy'
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  // Reload history, favorites, and privacy exclusions
  const reloadAuxiliaryData = useCallback(() => {
    if (window.seeklyAPI) {
      window.seeklyAPI.getRecentSearches?.().then(setRecentSearches).catch(console.error);
      window.seeklyAPI.getFavorites?.().then(setFavorites).catch(console.error);
      window.seeklyAPI.getExcludedFolders?.().then(setExcludedFolders).catch(console.error);
    }
  }, []);

  // Initial load and event subscriptions
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    if (window.seeklyAPI) {
      window.seeklyAPI.getIndexingStatus?.().then((st) => {
        if (st) setIndexingStatus(st);
      }).catch(console.error);

      reloadAuxiliaryData();

      const unsubIndex = window.seeklyAPI.onIndexingUpdate?.((update) => {
        if (update) setIndexingStatus(update);
      });

      const unsubShown = window.seeklyAPI.onWindowShown?.(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        reloadAuxiliaryData();
      });

      return () => {
        if (typeof unsubIndex === 'function') unsubIndex();
        if (typeof unsubShown === 'function') unsubShown();
      };
    }
  }, [reloadAuxiliaryData]);

  // Execute Search with Debounce (180ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    const hasFilter = quickFilter !== 'all' || advancedFilters.category !== 'all' || advancedFilters.dateRange !== 'any' || advancedFilters.sizeRange !== 'any' || advancedFilters.sortBy !== 'relevance';

    if (!trimmed && !hasFilter) {
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

  // File Actions
  const handleOpenFile = async (filePath) => {
    if (!window.seeklyAPI) return;
    const res = await window.seeklyAPI.openFile(filePath);
    if (!res.success) {
      showToast(res.error || 'Failed to open file', 'error');
    }
  };

  const handleOpenFileLocation = async (filePath) => {
    if (!window.seeklyAPI) return;
    const res = await window.seeklyAPI.openFileLocation(filePath);
    if (!res.success) {
      showToast(res.error || 'Failed to reveal location', 'error');
    }
  };

  const handleToggleFavorite = async (fileId) => {
    if (!window.seeklyAPI) return;
    await window.seeklyAPI.toggleFavorite(fileId);
    reloadAuxiliaryData();
    // Update local is_favorite flag in results
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

  // Privacy Actions
  const handleAddExclusion = async () => {
    if (!window.seeklyAPI) return;
    const folder = await window.seeklyAPI.selectFolderDialog();
    if (folder) {
      await window.seeklyAPI.addExcludedFolder(folder);
      reloadAuxiliaryData();
      showToast(`Excluded: ${folder}`, 'success');
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

  const isAnyFilterActive = isFilterPanelOpen || quickFilter !== 'all' || advancedFilters.category !== 'all' || advancedFilters.dateRange !== 'any' || advancedFilters.sizeRange !== 'any';

  return (
    <div className="seekly-window">
      {/* App Header (Draggable) */}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-logo">
            <Sparkles size={16} className="text-teal" />
          </div>
          <span className="brand-name">Seekly</span>
          <span className="version-pill">v1.0</span>
          <div className="shortcut-pill">
            <kbd>Ctrl</kbd> + <kbd>Space</kbd>
          </div>
        </div>

        {/* Header Navigation Tabs */}
        <nav className="header-tabs no-drag">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favorites');
              reloadAuxiliaryData();
            }}
          >
            <Star size={13} fill={favorites.length > 0 ? 'currentColor' : 'none'} />
            <span>Favorites {favorites.length > 0 ? `(${favorites.length})` : ''}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              reloadAuxiliaryData();
            }}
          >
            <Clock size={13} />
            <span>History</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('privacy');
              reloadAuxiliaryData();
            }}
          >
            <Shield size={13} />
            <span>Privacy</span>
          </button>
        </nav>

        {/* Window controls */}
        <div className="window-controls no-drag">
          <button
            type="button"
            onClick={() => window.seeklyAPI?.minimizeWindow?.()}
            className="win-ctrl-btn"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => window.seeklyAPI?.hideWindow?.()}
            className="win-ctrl-btn close-btn"
            title="Hide (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Main Search Bar Area */}
      <div className="search-section">
        <div className="search-controls-row">
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
          <SearchModeSelector
            activeMode={searchMode}
            onSelectMode={setSearchMode}
          />
        </div>

        {/* Quick Filter Chips */}
        <div className="quick-filters-row">
          {QUICK_FILTERS.map((f) => {
            const Icon = f.icon;
            const isSelected = quickFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                className={`quick-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setQuickFilter(f.id)}
              >
                <Icon size={12} className="chip-icon" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Collapsible Advanced Filter Panel */}
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

      {/* Main Content Area */}
      <main className="content-area">
        {toastMessage && (
          <div className={`app-toast toast-${toastMessage.type}`}>
            {toastMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {activeTab === 'privacy' ? (
          <PrivacyControls
            excludedFolders={excludedFolders}
            onAddExclusion={handleAddExclusion}
            onRemoveExclusion={handleRemoveExclusion}
            onRebuildIndex={handleRebuildIndex}
          />
        ) : activeTab === 'favorites' ? (
          <FavoriteFiles
            favorites={favorites}
            onOpen={handleOpenFile}
            onOpenLocation={handleOpenFileLocation}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : activeTab === 'history' ? (
          <RecentSearches
            searches={recentSearches}
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
        ) : query.trim() || quickFilter !== 'all' ? (
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
          <EmptyState type="initial" />
        )}
      </main>

      {/* Bottom Footer / Status Bar */}
      <footer className="app-footer">
        <div className="status-indicator-group">
          <span className={`status-dot ${indexingStatus.status === 'Ready' ? 'ready' : ''}`} />
          <span className="status-label">
            {indexingStatus.totalFiles > 0 
              ? `${indexingStatus.totalFiles.toLocaleString()} files indexed (${indexingStatus.extractedDocuments.toLocaleString()} docs)`
              : 'Local Search Ready'}
          </span>
        </div>

        <div className="keyboard-shortcuts-hint">
          <span className="shortcut-item"><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span className="shortcut-item"><kbd>↵</kbd> Open</span>
          <span className="shortcut-item"><kbd>Alt</kbd>+<kbd>↵</kbd> Reveal Location</span>
          <span className="shortcut-item"><kbd>Esc</kbd> Hide</span>
        </div>
      </footer>
    </div>
  );
}
