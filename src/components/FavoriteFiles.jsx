import React from 'react';
import { Star, FolderOpen, ExternalLink, Trash2 } from 'lucide-react';
import SearchResultItem from './SearchResultItem';

export default function FavoriteFiles({
  favorites,
  onOpen,
  onOpenLocation,
  onToggleFavorite
}) {
  if (!favorites || favorites.length === 0) {
    return (
      <div className="empty-substate">
        <Star size={32} className="text-muted" />
        <p className="text-secondary">No favorite items saved</p>
        <span className="text-dim text-xs">
          Click the star icon on any file or folder in search results to pin it here.
        </span>
      </div>
    );
  }

  return (
    <div className="favorites-view">
      <div className="section-header">
        <div className="section-title">
          <Star size={14} className="text-teal" fill="currentColor" />
          <span>Favorite Files & Folders ({favorites.length})</span>
        </div>
      </div>

      <div className="search-results-list">
        {favorites.map((item, idx) => (
          <SearchResultItem
            key={item.id}
            item={item}
            isSelected={false}
            onSelect={() => {}}
            onOpen={onOpen}
            onOpenLocation={onOpenLocation}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
