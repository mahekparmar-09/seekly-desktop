import React from 'react';
import { 
  FileText, 
  Folder, 
  AppWindow, 
  Image as ImageIcon, 
  Video, 
  Music, 
  File, 
  Star, 
  FolderOpen, 
  ExternalLink,
  BookOpen
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SearchResultItem({
  item,
  isSelected,
  onSelect,
  onOpen,
  onOpenLocation,
  onToggleFavorite
}) {
  const getIcon = () => {
    if (item.type === 'folder') return <Folder size={18} className="text-teal" />;
    if (item.type === 'app') return <AppWindow size={18} className="text-blue" />;
    if (item.category === 'images') return <ImageIcon size={18} className="text-teal" />;
    if (item.category === 'videos') return <Video size={18} className="text-teal" />;
    if (item.category === 'audio') return <Music size={18} className="text-teal" />;
    if (item.extension === '.pdf') return <FileText size={18} className="text-warning" />;
    if (item.extension === '.docx' || item.extension === '.doc') return <FileText size={18} className="text-blue" />;
    if (item.extension === '.txt') return <FileText size={18} className="text-muted" />;
    return <File size={18} className="text-muted" />;
  };

  return (
    <div
      className={`search-result-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      onDoubleClick={() => onOpen(item.path)}
    >
      <div className="result-main-row">
        <div className="result-icon-wrapper">
          {getIcon()}
        </div>

        <div className="result-info">
          <div className="result-title-line">
            <span className="result-name" title={item.name}>{item.name}</span>
            {item.extension && (
              <span className="badge badge-ext">{item.extension.toUpperCase().replace('.', '')}</span>
            )}
            {item.type === 'app' && (
              <span className="badge badge-app">APP</span>
            )}
            {item.matchType === 'content' && (
              <span className="badge badge-content">CONTENT MATCH</span>
            )}
          </div>

          <div className="result-meta-line">
            <span className="result-path" title={item.path}>{item.path}</span>
            <span className="meta-separator">•</span>
            {item.size > 0 && <span>{formatBytes(item.size)}</span>}
            {item.size > 0 && <span className="meta-separator">•</span>}
            <span>{formatDate(item.modified_at)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="result-actions no-drag">
          <button
            type="button"
            className={`action-btn fav-btn ${item.is_favorite ? 'favorited' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={15} fill={item.is_favorite ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLocation(item.path);
            }}
            title="Reveal in folder (Alt+Enter)"
          >
            <FolderOpen size={15} />
          </button>

          <button
            type="button"
            className="action-btn open-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(item.path);
            }}
            title="Open (Enter)"
          >
            <ExternalLink size={15} />
          </button>
        </div>
      </div>

      {/* Snippet Row if document content match */}
      {item.snippet && (
        <div className="result-snippet-row">
          {item.page_number && (
            <div className="page-pill">
              <BookOpen size={11} />
              <span>Page {item.page_number}</span>
            </div>
          )}
          <div
            className="snippet-text"
            dangerouslySetInnerHTML={{ __html: item.snippet }}
          />
        </div>
      )}
    </div>
  );
}
