import React from 'react';
import { Layers, FileText, AlignLeft } from 'lucide-react';

const modes = [
  { id: 'both', label: 'Both', icon: Layers, description: 'Search filenames and document contents' },
  { id: 'filename', label: 'Filename', icon: FileText, description: 'Search only file and folder names' },
  { id: 'content', label: 'Content', icon: AlignLeft, description: 'Search inside document text (PDF, DOCX, TXT)' }
];

export default function SearchModeSelector({ activeMode, onSelectMode }) {
  return (
    <div className="search-mode-selector">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            className={`mode-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectMode(mode.id)}
            title={mode.description}
          >
            <Icon size={14} className="mode-icon" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
