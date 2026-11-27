import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { TrackRoadmapNode } from '../lib/trackRoadmapNodes';
import { StatusBookIcon } from './TrackStatusIcons';

interface TrackBlogsModalProps {
  open: boolean;
  trackLabel: string;
  nodes: TrackRoadmapNode[];
  onClose: () => void;
}

export default function TrackBlogsModal({
  open,
  trackLabel,
  nodes,
  onClose,
}: TrackBlogsModalProps): JSX.Element | null {
  const navigate = useNavigate();
  const blogs = nodes.filter((n): n is Extract<TrackRoadmapNode, { kind: 'reading' }> => n.kind === 'reading');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('landing-modal-open');
    return () => document.body.classList.remove('landing-modal-open');
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="login-modal-overlay track-roadmap-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="login-modal track-roadmap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-blogs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-card login-modal-card track-roadmap-card">
          <header className="track-roadmap-header">
            <StatusBookIcon className="track-roadmap-header-icon" title="" />
            <div>
              <h2 id="track-blogs-title" className="track-roadmap-title">
                {trackLabel} blogs
              </h2>
              <p className="track-roadmap-sub">
                {blogs.length} reading{blogs.length === 1 ? '' : 's'}. Select one to open it.
              </p>
            </div>
            <button
              type="button"
              className="ghost track-roadmap-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          {blogs.length === 0 ? (
            <div className="track-roadmap-empty">No blogs loaded for this track yet.</div>
          ) : (
            <div className="track-roadmap-scroll" tabIndex={0} aria-label="Track blogs">
              <ol className="track-roadmap-list">
                {blogs.map((node) => (
                  <li key={node.key} className="track-roadmap-stop">
                    <button
                      type="button"
                      className="track-roadmap-item track-roadmap-item--blog"
                      aria-label={`${node.trackId} ${node.title}, Blog`}
                      onClick={() => {
                        onClose();
                        navigate(node.href);
                      }}
                    >
                      <span className="track-roadmap-dot" aria-hidden />
                      <span className="track-roadmap-id">{node.trackId}</span>
                      <span className="track-roadmap-title">{node.title}</span>
                      <span className="track-roadmap-meta">Blog</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
