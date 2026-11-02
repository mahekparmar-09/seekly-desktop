import React from 'react';

/**
 * SeeklyLogo component
 * Renders the official Seekly graphical symbol and brand mark.
 *
 * @param {'icon' | 'full'} variant - 'icon' renders only the emblem; 'full' renders emblem + wordmark
 * @param {number} size - pixel height of the emblem (default 26)
 * @param {boolean} showVersion - whether to show the v1.0 badge
 * @param {boolean} showTagline - whether to show "Search less. Find more."
 * @param {string} className - optional wrapper CSS class
 */
export default function SeeklyLogo({
  variant = 'icon',
  size = 26,
  showVersion = false,
  showTagline = false,
  className = ''
}) {
  // Standalone vector emblem
  const emblem = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="seekly-emblem-svg"
      aria-label="Seekly Icon"
    >
      <defs>
        <linearGradient id="emblemBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#141E33" />
          <stop offset="100%" stop-color="#0E1626" />
        </linearGradient>

        <linearGradient id="emblemBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#2878F0" stop-opacity="0.2" />
        </linearGradient>

        <linearGradient id="emblemLens" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#56CCF2" />
          <stop offset="50%" stop-color="#2F80ED" />
          <stop offset="100%" stop-color="#1D4ED8" />
        </linearGradient>

        <linearGradient id="emblemBeam" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38BDF8" />
          <stop offset="100%" stop-color="#1E40AF" />
        </linearGradient>

        <linearGradient id="emblemStar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#7DD3FC" />
        </linearGradient>
      </defs>

      {/* Base Rounded Squircle */}
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill="url(#emblemBg)"
        stroke="url(#emblemBorder)"
        strokeWidth="1.2"
      />

      {/* Back Document Card */}
      <rect
        x="18"
        y="16"
        width="22"
        height="26"
        rx="3.5"
        fill="#1E293B"
        stroke="#334155"
        strokeWidth="1"
      />

      {/* Front Active Document Card (Translucent Cyan) */}
      <rect
        x="23"
        y="21"
        width="22"
        height="26"
        rx="3.5"
        fill="#38BDF8"
        fillOpacity="0.18"
        stroke="#38BDF8"
        strokeOpacity="0.55"
        strokeWidth="1"
      />

      {/* Text Extraction scan lines */}
      <line x1="27" y1="27" x2="38" y2="27" stroke="#7DD3FC" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="32" x2="41" y2="32" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="27" y1="37" x2="36" y2="37" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />

      {/* Precision Search Optic Ring */}
      <circle cx="31" cy="31" r="16.5" fill="none" stroke="url(#emblemLens)" strokeWidth="4.5" strokeLinecap="round" />

      {/* Vector Handle Beam */}
      <path d="M43 43 L54 54" stroke="url(#emblemBeam)" strokeWidth="5" strokeLinecap="round" />

      {/* Discovery Focal Sparkle */}
      <g transform="translate(42, 20)">
        <path d="M0 -5 Q0 0 5 0 Q0 0 0 5 Q0 0 -5 0 Q0 0 0 -5 Z" fill="url(#emblemStar)" />
      </g>
    </svg>
  );

  if (variant === 'icon') {
    return <span className={`seekly-logo-icon-wrap ${className}`}>{emblem}</span>;
  }

  return (
    <div className={`seekly-brand-block ${className}`}>
      {emblem}
      <div className="seekly-brand-text">
        <div className="seekly-brand-title-line">
          <span className="seekly-brand-name">
            Seek<span className="seekly-brand-name-accent">ly</span>
          </span>
          {showVersion && <span className="seekly-brand-version">v1.0</span>}
        </div>
        {showTagline && <span className="seekly-brand-tagline">Search less. Find more.</span>}
      </div>
    </div>
  );
}

