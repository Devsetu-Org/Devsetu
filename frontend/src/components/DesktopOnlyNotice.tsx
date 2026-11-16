import React, { useState } from 'react';

interface DesktopOnlyNoticeProps {
  /** What is locked, e.g. "terminal and editor". */
  tools?: string;
  onShowBrief?: () => void;
  briefLabel?: string;
}

function IconLaptop(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 19.5h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M8.5 9l2 1.4-2 1.4M13 11.8h2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Replaces the hands-on workspace on small screens; the brief stays readable. */
export default function DesktopOnlyNotice({
  tools = 'terminal and editor',
  onShowBrief,
  briefLabel = 'Read the problem',
}: DesktopOnlyNoticeProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const shareLink = async () => {
    try {
      await navigator.share({ title: document.title, url: window.location.href });
    } catch {
      /* dismissed */
    }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="col col-main desktop-only-col">
      <div className="desktop-only-notice" role="status">
        <div className="desktop-only-icon" aria-hidden="true">
          <IconLaptop />
        </div>
        <p className="desktop-only-eyebrow">Desktop only</p>
        <h2 className="desktop-only-title">Continue on a laptop</h2>
        <p className="desktop-only-text">
          The {tools} need a keyboard and a wider screen. Everything else stays readable here, and
          your progress carries over when you open this same page on a laptop.
        </p>
        <div className="desktop-only-actions">
          {onShowBrief && (
            <button type="button" className="desktop-only-btn desktop-only-btn--primary" onClick={onShowBrief}>
              {briefLabel}
            </button>
          )}
          {canShare ? (
            <button type="button" className="desktop-only-btn desktop-only-btn--ghost" onClick={shareLink}>
              Send link to my laptop
            </button>
          ) : (
            <button type="button" className="desktop-only-btn desktop-only-btn--ghost" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy page link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
