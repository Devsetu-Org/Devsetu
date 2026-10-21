import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { TrackRoadmapNode } from '../lib/trackRoadmapNodes';
import type { ChallengePublic } from '../types/domain';
import { RoadmapIcon, StatusCheckIcon } from './TrackStatusIcons';

interface TrackRoadmapModalProps {
  open: boolean;
  trackLabel: string;
  nodes: TrackRoadmapNode[];
  onClose: () => void;
  onSelectLab: (challenge: ChallengePublic) => void | Promise<void>;
}

function nodeLabel(node: TrackRoadmapNode): string {
  const kind = node.kind === 'reading' ? 'Blog' : 'Lab';
  return `${node.trackId} ${node.title}, ${kind}`;
}

export default function TrackRoadmapModal({
  open,
  trackLabel,
  nodes,
  onClose,
  onSelectLab,
}: TrackRoadmapModalProps): JSX.Element | null {
  const navigate = useNavigate();

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

  const openNode = (node: TrackRoadmapNode): void => {
    if (node.kind === 'reading') {
      onClose();
      navigate(node.href);
      return;
    }
    if (node.playable) {
      onClose();
      void onSelectLab(node.challenge);
    }
  };

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
        aria-labelledby="track-roadmap-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-card login-modal-card track-roadmap-card">
          <header className="track-roadmap-header">
            <RoadmapIcon className="track-roadmap-header-icon" title="" />
            <div>
              <h2 id="track-roadmap-title" className="track-roadmap-title">
                {trackLabel} roadmap
              </h2>
              <p className="track-roadmap-sub">In track order. Select an item to open it.</p>
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

          {nodes.length === 0 ? (
            <div className="track-roadmap-empty">No track items loaded yet.</div>
          ) : (
            <div className="track-roadmap-scroll" tabIndex={0} aria-label="Track map">
              <ol className="track-roadmap-list">
                {nodes.map((node) => {
                  const solved = node.kind === 'lab' && node.solved;
                  const locked = node.kind === 'lab' && !node.playable;
                  const kind = node.kind === 'reading' ? 'Blog' : 'Lab';
                  const itemClass = [
                    'track-roadmap-item',
                    node.kind === 'reading' ? 'track-roadmap-item--blog' : 'track-roadmap-item--lab',
                    solved ? 'track-roadmap-item--solved' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <li key={node.key} className="track-roadmap-stop">
                      <button
                        type="button"
                        className={itemClass}
                        aria-label={nodeLabel(node)}
                        disabled={locked}
                        onClick={() => openNode(node)}
                      >
                        <span className="track-roadmap-dot" aria-hidden />
                        <span className="track-roadmap-id">{node.trackId}</span>
                        <span className="track-roadmap-title">{node.title}</span>
                        <span className="track-roadmap-meta">
                          {solved ? (
                            <StatusCheckIcon className="track-roadmap-check" title="Solved" />
                          ) : (
                            kind
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
