import React, { useEffect, useRef } from 'react';
import SearchResultItem from './SearchResultItem';

export default function SearchResults({
  results,
  selectedIndex,
  onSelectIndex,
  onOpen,
  onOpenLocation,
  onToggleFavorite
}) {
  const containerRef = useRef(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const selectedEl = containerRef.current.querySelector('.file-card.selected, .search-result-card.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="results-scroll-container" ref={containerRef}>
      {results.map((item, idx) => (
        <SearchResultItem
          key={item.id}
          item={item}
          isSelected={idx === selectedIndex}
          onSelect={() => onSelectIndex(idx)}
          onOpen={onOpen}
          onOpenLocation={onOpenLocation}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
