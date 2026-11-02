import React from 'react';
import { 
  FileText, 
  Folder, 
  AppWindow, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileCode,
  FileSpreadsheet,
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
  const getIconInfo = () => {
    if (item.type === 'folder') {
      return {
        icon: <Folder size={20} className="icon-folder" />,
        bgClass: 'icon-bg-amber',
        tag: 'FOLDER'
      };
    }
    if (item.type === 'app') {
      return {
        icon: <AppWindow size={20} className="icon-app" />,
        bgClass: 'icon-bg-purple',
        tag: 'APP'
      };
    }
    if (item.category === 'images') {
      return {
        icon: <ImageIcon size={20} className="icon-image" />,
        bgClass: 'icon-bg-cyan',
        tag: item.extension?.replace('.', '').toUpperCase() || 'IMG'
      };
    }
    if (item.category === 'videos') {
      return {
        icon: <Video size={20} className="icon-video" />,
        bgClass: 'icon-bg-cyan',
        tag: item.extension?.replace('.', '').toUpperCase() || 'VIDEO'
      };
    }
    if (item.category === 'audio') {
      return {
        icon: <Music size={20} className="icon-audio" />,
        bgClass: 'icon-bg-teal',
        tag: item.extension?.replace('.', '').toUpperCase() || 'AUDIO'
      };
    }

    const ext = (item.extension || '').toLowerCase();
    if (ext === '.pdf') {
      return {
        icon: <FileText size={20} className="icon-pdf" />,
        bgClass: 'icon-bg-red',
        tag: 'PDF'
      };
    }
    if (ext === '.docx' || ext === '.doc') {
      return {
        icon: <FileText size={20} className="icon-docx" />,
        bgClass: 'icon-bg-blue',
        tag: ext.replace('.', '').toUpperCase()
      };
    }
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      return {
        icon: <FileSpreadsheet size={20} className="icon-sheet" />,
        bgClass: 'icon-bg-green',
        tag: ext.replace('.', '').toUpperCase()
      };
    }
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx' || ext === '.json' || ext === '.html' || ext === '.xml' || ext === '.py') {
      return {
        icon: <FileCode size={20} className="icon-code" />,
        bgClass: 'icon-bg-sky',
        tag: ext.replace('.', '').toUpperCase()
      };
    }
    if (ext === '.txt' || ext === '.md' || ext === '.log') {
      return {
        icon: <FileText size={20} className="icon-txt" />,
        bgClass: 'icon-bg-slate',
        tag: ext.replace('.', '').toUpperCase()
      };
    }

    return {
      icon: <File size={20} className="icon-generic" />,
      bgClass: 'icon-bg-slate',
      tag: ext.replace('.', '').toUpperCase() || 'FILE'
    };
  };

  const { icon, bgClass, tag } = getIconInfo();

  return (
    <div
      className={`file-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      onDoubleClick={() => onOpen(item.path)}
    >
      {/* Left: Type Icon */}
      <div className={`card-icon-container ${bgClass}`}>
        {icon}
      </div>

      {/* Middle: File Details */}
      <div className="card-content">
        <div className="card-title-row">
          <span className="card-filename" title={item.name}>
            {item.name}
          </span>
          <span className="card-badge card-badge-type">{tag}</span>
          {(item.matchType === 'content' || (item.matchType === 'both' && item.snippet)) && (
            <span className="card-badge card-badge-match">CONTENT MATCH</span>
          )}
        </div>

        <div className="card-meta-row">
          <span className="card-path" title={item.path}>
            {item.path}
          </span>
          {item.type !== 'folder' && item.size > 0 && (
            <>
              <span className="card-meta-dot">•</span>
              <span className="card-meta-text">{formatBytes(item.size)}</span>
            </>
          )}
          {item.modified_at > 0 && (
            <>
              <span className="card-meta-dot">•</span>
              <span className="card-meta-text">{formatDate(item.modified_at)}</span>
            </>
          )}
        </div>

        {/* Snippet Row when search matched inside document */}
        {item.snippet && (
          <div className="card-snippet-container">
            {item.page_number && (
              <span className="card-page-pill">
                <BookOpen size={10} />
                <span>Page {item.page_number}</span>
              </span>
            )}
            <div
              className="card-snippet-text"
              dangerouslySetInnerHTML={{ __html: item.snippet }}
            />
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="card-actions no-drag">
        <button
          type="button"
          className={`card-action-btn ${item.is_favorite ? 'favorited' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={14} fill={item.is_favorite ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          className="card-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLocation(item.path);
          }}
          title="Open file location (Alt+Enter)"
        >
          <FolderOpen size={14} />
        </button>

        <button
          type="button"
          className="card-action-btn open-primary"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item.path);
          }}
          title="Open file (Enter)"
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
