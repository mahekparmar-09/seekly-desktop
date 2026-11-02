import React from 'react';
import { Shield, Cpu, HardDrive, Keyboard, ExternalLink, CheckCircle2 } from 'lucide-react';
import SeeklyLogo from './SeeklyLogo';

export default function AboutView() {
  return (
    <div className="about-view">
      {/* Hero Card */}
      <div className="about-hero-card">
        <div className="about-hero-header">
          <SeeklyLogo variant="full" size={48} showVersion={true} showTagline={true} />
        </div>

        <div className="about-features-grid">
          <div className="about-feature-item">
            <Cpu size={16} className="text-secondary-accent" />
            <div>
              <span className="about-feature-title">Instant Multithreaded Search</span>
              <p className="about-feature-desc">Asynchronous worker pool executes queries without UI lag</p>
            </div>
          </div>

          <div className="about-feature-item">
            <HardDrive size={16} className="text-secondary-accent" />
            <div>
              <span className="about-feature-title">Deep Document Extraction</span>
              <p className="about-feature-desc">Full-text indexing for PDF, DOCX, TXT, MD, CSV, JSON and more</p>
            </div>
          </div>

          <div className="about-feature-item">
            <Shield size={16} className="text-secondary-accent" />
            <div>
              <span className="about-feature-title">100% Local & Private</span>
              <p className="about-feature-desc">Zero telemetry, no cloud sync, your data stays on your PC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="about-section-card">
        <div className="about-section-title">
          <Keyboard size={15} className="text-accent" />
          <span>Keyboard Shortcuts</span>
        </div>
        <div className="shortcuts-table">
          <div className="shortcut-row">
            <span className="shortcut-desc">Toggle Seekly from anywhere</span>
            <div className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Space</kbd> or <kbd>Alt</kbd> + <kbd>Space</kbd></div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-desc">Navigate search results</span>
            <div className="shortcut-keys"><kbd>↑</kbd> <kbd>↓</kbd></div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-desc">Open selected item</span>
            <div className="shortcut-keys"><kbd>Enter</kbd></div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-desc">Reveal item in File Explorer</span>
            <div className="shortcut-keys"><kbd>Alt</kbd> + <kbd>Enter</kbd></div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-desc">Dismiss window or clear search</span>
            <div className="shortcut-keys"><kbd>Esc</kbd></div>
          </div>
        </div>
      </div>

      {/* System & Architecture Info */}
      <div className="about-meta-row">
        <span className="about-meta-item">
          <CheckCircle2 size={12} className="text-success" /> SQLite FTS5 (WAL Mode)
        </span>
        <span className="about-meta-separator">•</span>
        <span className="about-meta-item">Electron 34</span>
        <span className="about-meta-separator">•</span>
        <span className="about-meta-item">React 18</span>
        <span className="about-meta-separator">•</span>
        <span className="about-meta-item">Windows Fluent Architecture</span>
      </div>
    </div>
  );
}

