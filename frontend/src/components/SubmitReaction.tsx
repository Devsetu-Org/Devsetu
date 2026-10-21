import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type GradeModalPhase = 'grading' | 'pass' | 'fail' | 'resetting' | 'reset' | 'reset-fail';

const COPY: Record<GradeModalPhase, { title: string; sub: string }> = {
  grading: { title: 'Grading', sub: 'Checking this lab.' },
  pass: { title: 'Passed', sub: 'This submission passed.' },
  fail: { title: 'Failed', sub: 'This submission did not pass.' },
  resetting: { title: 'Resetting', sub: 'Putting this lab back to its original state.' },
  reset: { title: 'Reset', sub: 'This lab is back to its original state.' },
  'reset-fail': { title: 'Reset failed', sub: 'This lab could not be reset.' },
};

function StatusRing({ phase }: { phase: GradeModalPhase }) {
  const working = phase === 'grading' || phase === 'resetting';
  const failed = phase === 'fail' || phase === 'reset-fail';
  const label = working ? (phase === 'resetting' ? 'Resetting' : 'Grading') : failed ? 'Failed' : 'Passed';
  return (
    <div
      className={`grade-ring${working ? '' : ' is-done'}${failed ? ' is-fail' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={working ? undefined : 100}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="grade-ring-track" cx="24" cy="24" r="18" />
        <circle className="grade-ring-arc" cx="24" cy="24" r="18" />
        {!working && !failed && <path className="grade-ring-mark" d="M16 24.5 L21.5 30 L32 18.5" />}
        {!working && failed && <path className="grade-ring-mark" d="M18 18 L30 30 M30 18 L18 30" />}
      </svg>
    </div>
  );
}

export function SubmitReaction({
  phase,
  onClose,
}: {
  phase: GradeModalPhase;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copy = COPY[phase];
  const working = phase === 'grading' || phase === 'resetting';

  return createPortal(
    <div className="grade-modal-overlay">
      <div
        className={`grade-modal grade-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grade-modal-title"
        aria-busy={working}
      >
        <header className="grade-modal-head">
          <div>
            <h2 id="grade-modal-title">{copy.title}</h2>
            <p className="grade-modal-sub">{copy.sub}</p>
          </div>
          <button type="button" className="grade-modal-close" aria-label="Close" onClick={() => onCloseRef.current()}>
            ×
          </button>
        </header>
        <StatusRing phase={phase} />
      </div>
    </div>,
    document.body,
  );
}
