import React, { useEffect, useRef } from 'react';
import {
  commandLabel,
  parseProjectRunProgress,
  type CaseStatus,
  type ProjectRunProgress,
  type StepStatus,
} from '../utils/projectRunProgress';

function caseMark(status: CaseStatus): string {
  if (status === 'passed') return '✓';
  if (status === 'failed') return '✗';
  if (status === 'skipped') return '–';
  return '●';
}

function stepMark(status: StepStatus): string {
  if (status === 'passed') return '✓';
  if (status === 'failed') return '✗';
  if (status === 'running') return '●';
  return '○';
}

function summaryText(progress: ProjectRunProgress, inFlight: boolean): string {
  const { passed, failed, skipped, running, total } = progress;
  if (total === 0) {
    if (inFlight) {
      return progress.currentCommand
        ? `Running ${commandLabel(progress.currentCommand)}…`
        : 'Starting…';
    }
    return progress.finished ? 'No tests reported' : 'Waiting…';
  }
  const parts = [`${passed} passed`];
  if (failed > 0 || (!inFlight && progress.finished)) parts.push(`${failed} failed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (running > 0) parts.push(`${running} running`);
  return parts.join(' · ');
}

export default function ProjectRunProgressPanel({
  logs,
  inFlight,
}: {
  logs: string;
  inFlight: boolean;
}): JSX.Element {
  const progress = parseProjectRunProgress(logs);
  const listRef = useRef<HTMLUListElement | null>(null);
  const done = progress.total - progress.running;
  const pct =
    progress.total === 0 ? (inFlight ? 8 : 0) : Math.round((done / progress.total) * 100);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [progress.cases.length, progress.running, progress.currentCommand]);

  const live = inFlight && !progress.finished;
  const tone =
    progress.failed > 0
      ? 'project-run-progress--fail'
      : progress.finished && progress.failed === 0 && (progress.total > 0 || progress.steps.length > 0)
        ? 'project-run-progress--ok'
        : live
          ? 'project-run-progress--live'
          : '';

  if (!logs.trim() && !live) {
    return (
      <div className="project-run-progress">
        <p className="project-run-progress-empty">Hit play to run the chapter tests.</p>
      </div>
    );
  }

  return (
    <div className={`project-run-progress project-run-progress--solo ${tone}`.trim()}>
      <div className="project-run-progress-top">
        <div className="project-run-progress-summary">
          <strong>{summaryText(progress, live)}</strong>
          {progress.total > 0 && (
            <span className="project-run-progress-count">
              {done}/{progress.total}
            </span>
          )}
        </div>
        <div
          className="project-run-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Test progress"
        >
          <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      </div>

      {progress.steps.length > 0 && (
        <ul className="project-run-progress-steps">
          {progress.steps.map((step, index) => (
            <li
              key={`${index}:${step.command}`}
              className={`project-run-progress-step project-run-progress-step--${step.status}`}
            >
              <span className="project-run-progress-mark" aria-hidden>
                {stepMark(step.status)}
              </span>
              <span>{commandLabel(step.command)}</span>
              {step.cases.length > 0 && (
                <span className="project-run-progress-step-meta">
                  {step.cases.filter((c) => c.status === 'passed').length}/
                  {step.cases.length}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {progress.cases.length > 0 && (
        <ul ref={listRef} className="project-run-progress-cases">
          {progress.cases.map((c) => (
            <li
              key={c.id}
              className={`project-run-progress-case project-run-progress-case--${c.status}`}
            >
              <span className="project-run-progress-mark" aria-hidden>
                {caseMark(c.status)}
              </span>
              <span className="project-run-progress-case-name">{c.name}</span>
              <span className="project-run-progress-case-status">{c.status}</span>
            </li>
          ))}
        </ul>
      )}

      {(progress.finished || (!live && progress.total > 0)) && (
        <p className="project-run-progress-final" role="status">
          {progress.total === 0 && progress.steps.every((s) => s.status === 'passed')
            ? 'All checks passed'
            : progress.failed === 0
              ? `All ${progress.passed} tests passed`
              : `${progress.passed} passed, ${progress.failed} failed`}
          {progress.skipped > 0 ? `, ${progress.skipped} skipped` : ''}
        </p>
      )}
    </div>
  );
}
