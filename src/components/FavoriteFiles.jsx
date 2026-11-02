import React from 'react';
import { Star } from 'lucide-react';
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
        <div className="empty-icon-ring">
          <Star size={32} className="text-secondary-accent" />
        </div>
        <p className="empty-substate-title">No favorite items pinned</p>
        <span className="empty-substate-desc">
          Click the star icon on any search result to pin it here for instant access.
        </span>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="page-header-row">
        <div className="page-header-title">
          <Star size={16} className="text-secondary-accent" fill="currentColor" />
          <span>Favorite Items</span>
          <span className="page-header-badge">{favorites.length}</span>
        </div>
      </div>

      <div className="results-scroll-container">
        {favorites.map((item) => (
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
