/**
 * Hybrid track lab: Labs-style brief (Description / Solution / Submissions)
 * on the left, Projects-style code editor only on the right (no terminal).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveSession, ChallengeFull, ChallengePublic } from '../types/domain';
import { useAppState } from '../context/AppStateContext';
import { fetchChallenge, fetchChallengeSolution } from '../services/challengeApi';
import { runProjectModule } from '../services/projectRun';
import {
  languageLabel,
  loadRunHistory,
  newRunId,
  saveRunHistory,
  type ProjectRunHistoryEntry,
} from '../utils/projectRunHistory';
import type { ProjectRunStatus } from '../services/projectRun';
import { readSavedFiles, workspaceFilesKeys } from '../utils/workspaceFiles';
import { removeMigrating, writeMigrating } from '../utils/storageMigrate';
import { useIsNarrowUi } from '../hooks/useMediaQuery';
import BriefBackButton from './BriefBackButton';
import ProblemStatement, { type ProblemStatementTab } from './ProblemStatement';
import SolutionGateModal, { hasAcknowledgedSolution } from './SolutionGateModal';
import SparkProjectEditor from './SparkProjectEditor';
import WorkspaceMobileSwitcher, {
  type WorkspaceMobilePane,
} from './WorkspaceMobileSwitcher';
import DesktopOnlyNotice from './DesktopOnlyNotice';
import {
  resolveProjectLabContent,
  type ProjectLabSpec,
} from '../utils/projectLabContent';
import type { ProjectModuleContent } from '../fixtures/projectModules/types';

const BRIEF_RATIO = 0.38;
const BRIEF_MIN = 280;
const BRIEF_MAX_RATIO = 0.55;
const LOGS_DRAWER_DEFAULT = 220;
const LOGS_DRAWER_MIN = 120;

function clampBriefWidth(px: number, shellWidth: number): number {
  const max = Math.floor(shellWidth * BRIEF_MAX_RATIO);
  return Math.min(max, Math.max(BRIEF_MIN, Math.round(px)));
}

function loadSavedLabFiles(
  persistId: string,
  starter: Record<string, string>,
): Record<string, string> {
  const saved = readSavedFiles(persistId);
  if (!saved) return starter;
  const restored: Record<string, string> = {};
  for (const path of Object.keys(starter)) {
    restored[path] = saved[path] ?? starter[path];
  }
  return restored;
}

function runVerdict(status: ProjectRunStatus): string {
  if (status === 'succeeded') return 'Accepted';
  if (status === 'failed') return 'Wrong Answer';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'queued' || status === 'starting' || status === 'running') return 'In Progress';
  return status;
}

export interface ProjectLabWorkspaceProps {
  challenge: ChallengePublic | ChallengeFull | null;
  session: ActiveSession;
}

export default function ProjectLabWorkspace({
  challenge,
}: ProjectLabWorkspaceProps): JSX.Element {
  const { onBackToLibrary } = useAppState();
  const resolved = useMemo(() => resolveProjectLabContent(challenge), [challenge]);
  const content: ProjectModuleContent | null = resolved?.content ?? null;
  const spec: ProjectLabSpec | null = resolved?.spec ?? null;
  const persistId = challenge?.id ? `lab.${challenge.id}` : 'lab.unknown';
  const historyScope = persistId;

  const [briefChallenge, setBriefChallenge] = useState(challenge);
  const [briefTab, setBriefTab] = useState<ProblemStatementTab>('description');
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [briefWidth, setBriefWidth] = useState(() =>
    typeof window !== 'undefined'
      ? clampBriefWidth(window.innerWidth * BRIEF_RATIO, window.innerWidth)
      : 420,
  );
  const isNarrow = useIsNarrowUi();
  const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('brief');

  const [files, setFiles] = useState<Record<string, string>>(() =>
    content ? loadSavedLabFiles(persistId, content.files) : {},
  );
  const [focusFile, setFocusFile] = useState(() => {
    if (!content) return '';
    const task = resolved?.initialTaskId
      ? content.tasks.find((t) => t.id === resolved.initialTaskId)
      : null;
    return task?.file || content.entryFile;
  });

  const [solutionFiles, setSolutionFiles] = useState<Record<string, string> | null>(null);
  const [solutionEntrypoint, setSolutionEntrypoint] = useState<string | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [solutionGateOpen, setSolutionGateOpen] = useState(false);

  const [runHistory, setRunHistory] = useState<ProjectRunHistoryEntry[]>(() =>
    loadRunHistory(historyScope),
  );
  const [viewingRunId, setViewingRunId] = useState<string | null>(
    () => loadRunHistory(historyScope)[0]?.id ?? null,
  );
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<ProjectRunStatus | 'idle'>('idle');
  const [runLogs, setRunLogs] = useState(() => loadRunHistory(historyScope)[0]?.logs ?? '');
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsDrawerHeight, setLogsDrawerHeight] = useState(LOGS_DRAWER_DEFAULT);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const ideBodyRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const resizingLogs = useRef(false);
  const runAbortRef = useRef<AbortController | null>(null);
  const liveRunIdRef = useRef(liveRunId);
  liveRunIdRef.current = liveRunId;

  const challengeId = challenge?.id || '';
  const runInFlight = runStatus === 'starting' || runStatus === 'running';
  const hasRun = runHistory.length > 0 || Boolean(liveRunId);
  const showLogsBar = hasRun && !logsOpen;
  const showBrief = isNarrow ? mobilePane === 'brief' : !briefCollapsed;
  const showWorkspace = isNarrow ? mobilePane === 'workspace' : true;
  const showResize = !isNarrow && !briefCollapsed;

  const viewingRun = runHistory.find((r) => r.id === viewingRunId) ?? runHistory[0] ?? null;
  const displayLogs =
    liveRunId && viewingRunId === liveRunId ? runLogs : viewingRun?.logs ?? runLogs;

  // Hydrate full challenge (description / solution assets).
  useEffect(() => {
    setBriefChallenge(challenge);
    if (!challenge?.id) return;
    let cancelled = false;
    void fetchChallenge(challenge.id)
      .then((full) => {
        if (!cancelled) setBriefChallenge(full);
      })
      .catch(() => {
        /* keep list payload */
      });
    return () => {
      cancelled = true;
    };
  }, [challenge?.id]);

  // Reset editor when switching labs.
  useEffect(() => {
    if (!content) return;
    setFiles(loadSavedLabFiles(persistId, content.files));
    const task = resolved?.initialTaskId
      ? content.tasks.find((t) => t.id === resolved.initialTaskId)
      : null;
    setFocusFile(task?.file || content.entryFile);
    setBriefTab('description');
    setSolutionFiles(null);
    setSolutionEntrypoint(null);
    setSolutionError(null);
    setLogsOpen(false);
    setRunStatus('idle');
    const history = loadRunHistory(historyScope);
    setRunHistory(history);
    setViewingRunId(history[0]?.id ?? null);
    setRunLogs(history[0]?.logs ?? '');
  }, [persistId, content, resolved?.initialTaskId, historyScope]);

  useEffect(() => {
    if (!content || Object.keys(files).length === 0) return;
    const t = window.setTimeout(() => {
      try {
        const { next, legacy } = workspaceFilesKeys(persistId);
        writeMigrating(window.localStorage, next, legacy, JSON.stringify(files));
      } catch {
        // Quota — ignore.
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [files, persistId, content]);

  useEffect(() => {
    saveRunHistory(historyScope, runHistory);
  }, [historyScope, runHistory]);

  useEffect(() => {
    if (briefTab !== 'solution' || !challengeId) return;
    if (solutionFiles || solutionError) return;
    let cancelled = false;
    setSolutionLoading(true);
    void fetchChallengeSolution(challengeId)
      .then((payload) => {
        if (cancelled) return;
        setSolutionFiles(payload.files || {});
        setSolutionEntrypoint(payload.entrypoint || null);
        setSolutionError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSolutionFiles(null);
        setSolutionError(e instanceof Error ? e.message : 'Failed to load solution');
      })
      .finally(() => {
        if (!cancelled) setSolutionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [briefTab, challengeId, solutionFiles, solutionError]);

  const patchLiveRun = useCallback(
    (patch: Partial<ProjectRunHistoryEntry> & { id: string }): void => {
      setRunHistory((prev) => {
        const existing = prev.find((r) => r.id === patch.id);
        const nextEntry: ProjectRunHistoryEntry = {
          id: patch.id,
          language: patch.language ?? existing?.language ?? spec?.language ?? null,
          status: patch.status ?? existing?.status ?? 'starting',
          logs: patch.logs ?? existing?.logs ?? '',
          createdAt: patch.createdAt ?? existing?.createdAt ?? Date.now(),
          finishedAt:
            patch.finishedAt !== undefined
              ? patch.finishedAt
              : (existing?.finishedAt ?? null),
        };
        const rest = prev.filter((r) => r.id !== patch.id);
        return [nextEntry, ...rest].slice(0, 40);
      });
    },
    [spec?.language],
  );

  const handleStopRun = useCallback((): void => {
    runAbortRef.current?.abort();
  }, []);

  const handleResetToStarter = useCallback((): void => {
    if (!content || runInFlight) return;
    if (
      !window.confirm(
        'Reset this lab to the starter? Your edits here are discarded.',
      )
    ) {
      return;
    }
    try {
      const { next, legacy } = workspaceFilesKeys(persistId);
      removeMigrating(window.localStorage, next, legacy);
    } catch {
      // ignore
    }
    setFiles(content.files);
    setFocusFile(
      (resolved?.initialTaskId &&
        content.tasks.find((t) => t.id === resolved.initialTaskId)?.file) ||
        content.entryFile,
    );
  }, [content, runInFlight, persistId, resolved?.initialTaskId]);

  const handleRun = useCallback((): void => {
    if (!content || runInFlight) return;
    if (content.verify.length === 0) return;
    runAbortRef.current?.abort();
    const ac = new AbortController();
    runAbortRef.current = ac;
    const id = newRunId();
    const createdAt = Date.now();
    setLiveRunId(id);
    setViewingRunId(id);
    setLogsOpen(true);
    setRunLogs('');
    setRunStatus('starting');
    patchLiveRun({
      id,
      language: spec?.language ?? null,
      status: 'starting',
      logs: '',
      createdAt,
      finishedAt: null,
    });

    void (async () => {
      let latestLogs = '';
      let latestStatus: ProjectRunStatus = 'starting';
      try {
        await runProjectModule({
          persistId,
          commands: content.verify,
          files,
          signal: ac.signal,
          onLog: (logs) => {
            latestLogs = logs;
            setRunLogs(logs);
            patchLiveRun({ id, logs, status: latestStatus });
          },
          onStatus: (status) => {
            latestStatus = status;
            setRunStatus(status);
            patchLiveRun({
              id,
              status,
              logs: latestLogs,
              finishedAt:
                status === 'succeeded' || status === 'failed' || status === 'cancelled'
                  ? Date.now()
                  : null,
            });
          },
        });
        patchLiveRun({
          id,
          status: 'succeeded',
          logs: latestLogs,
          finishedAt: Date.now(),
        });
        setRunStatus('succeeded');
      } catch (e) {
        if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          const logs = latestLogs.includes('cancelled')
            ? latestLogs
            : `${latestLogs}\nRun cancelled. Runner released.\n`;
          setRunStatus('cancelled');
          setRunLogs(logs);
          patchLiveRun({ id, status: 'cancelled', logs, finishedAt: Date.now() });
          return;
        }
        const message = e instanceof Error ? e.message : 'Run failed.';
        const logs = latestLogs.includes(message) ? latestLogs : `${latestLogs}\n${message}\n`;
        setRunStatus('failed');
        setRunLogs(logs);
        patchLiveRun({ id, status: 'failed', logs, finishedAt: Date.now() });
      } finally {
        if (runAbortRef.current === ac) runAbortRef.current = null;
        if (liveRunIdRef.current === id) setLiveRunId(null);
      }
    })();
  }, [content, runInFlight, persistId, files, patchLiveRun, spec?.language]);

  const onResizeMove = useCallback((e: MouseEvent) => {
    if (dragging.current && shellRef.current) {
      const rect = shellRef.current.getBoundingClientRect();
      setBriefWidth(clampBriefWidth(e.clientX - rect.left, rect.width));
    }
    if (resizingLogs.current && ideBodyRef.current) {
      const rect = ideBodyRef.current.getBoundingClientRect();
      const next = rect.bottom - e.clientY;
      const max = Math.max(LOGS_DRAWER_MIN, Math.floor(rect.height * 0.9));
      setLogsDrawerHeight(Math.min(max, Math.max(LOGS_DRAWER_MIN, next)));
    }
  }, []);

  const onResizeEnd = useCallback(() => {
    dragging.current = false;
    resizingLogs.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
    return () => {
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', onResizeEnd);
    };
  }, [onResizeMove, onResizeEnd]);

  if (!challenge || !content) {
    return (
      <div className="app-page app-page-centered">
        <p>This project lab is missing its coding workspace.</p>
        <button type="button" onClick={onBackToLibrary}>
          Back to labs
        </button>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`workspace sandbox-workspace spark-platform-workspace k8s-lab-workspace project-lab-workspace${
        !isNarrow && briefCollapsed ? ' spark-brief-collapsed' : ''
      }${isNarrow ? ` workspace--mobile workspace--mobile-pane-${mobilePane}` : ''}`}
      style={
        isNarrow || briefCollapsed
          ? { gridTemplateColumns: 'minmax(0, 1fr)' }
          : { gridTemplateColumns: `${briefWidth}px 6px minmax(0, 1fr)` }
      }
    >
      {isNarrow && (
        <WorkspaceMobileSwitcher
          pane={mobilePane}
          onChange={setMobilePane}
          briefLabel="Brief"
          workspaceLabel="Editor"
        />
      )}

      {showBrief && (
        <div className="col spark-brief-col">
          <div className="panel sandbox-brief-panel--solo spark-brief-panel--bare" style={{ flex: 1 }}>
            <div className="spark-brief-tabs" role="tablist" aria-label="Problem sections">
              {!isNarrow && <BriefBackButton />}
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'description'}
                className={`spark-brief-tab${briefTab === 'description' ? ' active' : ''}`}
                onClick={() => setBriefTab('description')}
              >
                Description
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'solution'}
                className={`spark-brief-tab${briefTab === 'solution' ? ' active' : ''}`}
                onClick={() => {
                  if (hasAcknowledgedSolution(challengeId)) {
                    if (!solutionFiles && !solutionError) setSolutionLoading(true);
                    setBriefTab('solution');
                  } else {
                    setSolutionGateOpen(true);
                  }
                }}
              >
                Solution
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'submissions'}
                className={`spark-brief-tab${briefTab === 'submissions' ? ' active' : ''}`}
                onClick={() => setBriefTab('submissions')}
              >
                Submissions
                {runHistory.length > 0 && (
                  <span className="spark-brief-tab-count">{runHistory.length}</span>
                )}
              </button>
              {!isNarrow && (
                <button
                  type="button"
                  className="spark-brief-collapse-btn"
                  title="Collapse problem panel"
                  aria-label="Collapse problem panel"
                  onClick={() => setBriefCollapsed(true)}
                >
                  ⟨
                </button>
              )}
            </div>
            <div className="panel-body spark-brief-body">
              <ProblemStatement
                challenge={briefChallenge || challenge}
                tab={briefTab}
                solutionFiles={solutionFiles}
                solutionEntrypoint={solutionEntrypoint}
                solutionLoading={solutionLoading}
                solutionError={solutionError}
                submissionsSlot={
                  briefTab === 'submissions' ? (
                    <div className="k8s-submission-table">
                      {runHistory.length === 0 ? (
                        <p className="k8s-submission-empty">
                          No runs yet. Use <strong>Run</strong> in the editor to verify locally.
                          Graded Submit for this lab kind ships next.
                        </p>
                      ) : (
                        <>
                          <div className="k8s-submission-head">
                            <span>#</span>
                            <span>ID</span>
                            <span>Verdict</span>
                            <span>Submitted</span>
                          </div>
                          {runHistory.map((run, index) => {
                            const attempt = runHistory.length - index;
                            const pending =
                              run.status === 'starting' ||
                              run.status === 'running' ||
                              run.status === 'queued';
                            const verdict = runVerdict(run.status);
                              const lang = languageLabel(run.language);
                              const when = run.createdAt
                                ? new Date(run.createdAt).toLocaleString()
                                : '';
                              return (
                                <button
                                  key={run.id}
                                  type="button"
                                  className={`k8s-submission-row${
                                    pending
                                      ? ' is-pending'
                                      : run.status === 'succeeded'
                                        ? ' is-pass'
                                        : ' is-fail'
                                  }${viewingRunId === run.id ? ' is-selected' : ''}`}
                                  onClick={() => {
                                    setViewingRunId(run.id);
                                    setRunLogs(run.logs);
                                    setLogsOpen(true);
                                    if (isNarrow) setMobilePane('workspace');
                                  }}
                                >
                                  <span className="k8s-submission-num">{attempt}</span>
                                  <span className="k8s-submission-sid" title={run.id}>
                                    {run.id.slice(0, 8)}
                                    {lang ? ` · ${lang}` : ''}
                                  </span>
                                <span className="k8s-submission-verdict">{verdict}</span>
                                <span className="k8s-submission-time">{when}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  ) : null
                }
              />
            </div>
          </div>
        </div>
      )}

      {showResize && (
        <div
          className="spark-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize problem panel"
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />
      )}

      {!isNarrow && briefCollapsed && (
        <button
          type="button"
          className="spark-brief-reopen-float"
          title="Show problem panel"
          aria-label="Show problem panel"
          onClick={() => setBriefCollapsed(false)}
        >
          ⟩
        </button>
      )}

      {showWorkspace && isNarrow && (
        <DesktopOnlyNotice
          tools="code editor"
          briefLabel="Read the brief"
          onShowBrief={() => setMobilePane('brief')}
        />
      )}

      {showWorkspace && !isNarrow && (
        <div className="col col-main">
          <div className="panel spark-ide-panel" style={{ flex: 1 }}>
            <div
              ref={ideBodyRef}
              className={[
                'panel-body flush spark-ide-body',
                logsOpen ? 'spark-ide-body--job-open' : '',
                showLogsBar ? 'spark-ide-body--has-logs-bar' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                logsOpen
                  ? ({
                      ['--spark-job-drawer-h' as string]: `${logsDrawerHeight}px`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <SparkProjectEditor
                key={persistId}
                files={files}
                onChangeFiles={setFiles}
                entryFile={focusFile}
                onResetToStarter={handleResetToStarter}
                onRun={handleRun}
                onStopRun={handleStopRun}
                runInFlight={runInFlight}
                runDisabled={content.verify.length === 0}
              />

              {showLogsBar && (
                <button
                  type="button"
                  className="spark-results-reopen"
                  onClick={() => setLogsOpen(true)}
                  title="Show results"
                  aria-expanded={false}
                  aria-controls="project-lab-logs-drawer"
                >
                  <span>Results</span>
                  <span className="spark-results-reopen-chevron" aria-hidden>
                    ⌃
                  </span>
                </button>
              )}

              {logsOpen && (
                <div
                  id="project-lab-logs-drawer"
                  className="spark-job-drawer spark-results-drawer project-logs-drawer"
                  style={{ height: logsDrawerHeight }}
                  role="region"
                  aria-label="Run logs"
                >
                  <div
                    className="spark-job-drawer-resize"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      resizingLogs.current = true;
                      document.body.style.cursor = 'row-resize';
                      document.body.style.userSelect = 'none';
                    }}
                  />
                  <div className="spark-job-drawer-head">
                    <strong>Results</strong>
                    <button
                      type="button"
                      className="ghost sm"
                      onClick={() => setLogsOpen(false)}
                    >
                      Hide
                    </button>
                  </div>
                  <pre className="spark-job-drawer-log">{displayLogs || 'No output yet.'}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SolutionGateModal
        open={solutionGateOpen}
        challengeId={challengeId}
        onCancel={() => setSolutionGateOpen(false)}
        onConfirm={() => {
          setSolutionGateOpen(false);
          if (!solutionFiles && !solutionError) setSolutionLoading(true);
          setBriefTab('solution');
        }}
      />
    </div>
  );
}
