import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import MarkdownProse from '../components/MarkdownProse';
import ProjectRunProgressPanel from '../components/ProjectRunProgressPanel';
import SparkProjectEditor from '../components/SparkProjectEditor';
import WorkspaceMobileSwitcher, {
  type WorkspaceMobilePane,
} from '../components/WorkspaceMobileSwitcher';
import DesktopOnlyNotice from '../components/DesktopOnlyNotice';
import { MAJORS_PATH, getProject, getProjectModule } from '../constants/projects';
import { getModuleContent } from '../fixtures/projectModules';
import type { ProjectModuleContent } from '../fixtures/projectModules';
import { useIsNarrowUi } from '../hooks/useMediaQuery';
import {
  runProjectModule,
  type ProjectRunStatus,
} from '../services/projectRun';
import {
  type CarryPlan,
  type EarlierChapter,
  joinLabels,
  ownedFiles,
  planCarry,
} from '../utils/chapterCarry';
import type { LanguageId } from '../constants/languages';
import {
  languageLabel,
  loadRunHistory,
  newRunId,
  saveRunHistory,
  upsertRunHistory,
  type ProjectRunHistoryEntry,
} from '../utils/projectRunHistory';
import { readMigrating, removeMigrating, writeMigrating } from '../utils/storageMigrate';
import { countDone, readSavedFiles, taskDone, workspaceFilesKeys } from '../utils/workspaceFiles';

type BriefTab = 'theory' | 'tasks' | 'runs';

const BRIEF_MIN = 320;
const BRIEF_RATIO = 0.48;
const BRIEF_MAX_RATIO = 0.62;

const LOGS_DRAWER_MIN = 140;
const LOGS_DRAWER_DEFAULT = 280;

/** Match track Submissions verdict wording. */
function runVerdict(status: ProjectRunStatus): string {
  if (status === 'starting' || status === 'running' || status === 'queued') return 'In Progress';
  if (status === 'succeeded') return 'Accepted';
  if (status === 'cancelled') return 'Cancelled';
  return 'Wrong Answer';
}

function runStamp(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function runShortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

function clampBriefWidth(width: number, shellWidth: number): number {
  const max = Math.max(BRIEF_MIN, Math.floor(shellWidth * BRIEF_MAX_RATIO));
  return Math.min(max, Math.max(BRIEF_MIN, Math.round(width)));
}

function theoryStorageKeys(persistId: string): { next: string; legacy: string } {
  return {
    next: `devsetu.workspace.${persistId}.theory`,
    legacy: `devlabs.workspace.${persistId}.theory`,
  };
}

function loadSavedTheory(persistId: string, fallback: string): string {
  try {
    const { next, legacy } = theoryStorageKeys(persistId);
    const raw = readMigrating(window.localStorage, next, legacy);
    if (typeof raw === 'string' && raw.trim()) return raw;
  } catch {
    // ignore
  }
  return fallback;
}

/** Edits live in the browser until modules get a backend workspace. */
function loadSavedFiles(
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

interface StartState {
  files: Record<string, string>;
  /** Set while an earlier chapter is unfinished and the learner has not chosen. */
  gate: CarryPlan | null;
  note: string | null;
}

function carryNote(plan: CarryPlan): string | null {
  const parts: string[] = [];
  if (plan.fromLearner.length > 0) {
    parts.push(`Your code from ${joinLabels(plan.fromLearner)} is carried in.`);
  }
  if (plan.unfinished.length > 0) {
    const verb = plan.unfinished.length === 1 ? 'uses' : 'use';
    parts.push(`${joinLabels(plan.unfinished)} ${verb} the reference solution.`);
  }
  if (parts.length === 0) return null;
  return parts.join(' ');
}

/** Saved work wins; a first visit starts from the learner's earlier chapters. */
function startState(
  persistId: string,
  content: ProjectModuleContent,
  earlier: EarlierChapter[] | undefined,
): StartState {
  if (!earlier?.length || readSavedFiles(persistId)) {
    return { files: loadSavedFiles(persistId, content.files), gate: null, note: null };
  }
  const plan = planCarry(content.files, earlier, readSavedFiles);
  if (plan.unfinished.length > 0) return { files: content.files, gate: plan, note: null };
  return { files: plan.files, gate: null, note: carryNote(plan) };
}

interface TheorySection {
  title: string;
  body: string;
}

const MODE_META =
  /^<!--\s*mode:\s*(read-only|read-and-implement)(?:\s+tasks:([\d.,\s]+))?\s*-->\s*$/m;

/** Drop mode comments — tasks live only under the Tasks tab. */
function stripTheoryMeta(body: string): string {
  return body.replace(MODE_META, '').trim();
}

/**
 * TODO headings and their bodies belong in Tasks, not Theory. Drop every
 * `### …TODO(…)…` block (and empty language wrappers left behind).
 */
function stripTodoSections(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let skipping = false;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence) {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        if (/TODO\s*\(/i.test(heading[2])) {
          skipping = true;
          continue;
        }
        skipping = false;
      }
    }

    if (!skipping) out.push(line);
  }

  return out
    .join('\n')
    .replace(/<!--\s*lang:[^>]*-->\s*<!--\s*\/lang\s*-->/g, '')
    .replace(/<!--\s*lang:[^>]*-->\s*/g, '')
    .replace(/\s*<!--\s*\/lang\s*-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface TodoBrief {
  /** Optional subtitle from the heading, e.g. `findGreaterOrEqual`. */
  focus: string;
  /** Markdown body under the TODO heading — the task expectation. */
  body: string;
}

/**
 * Pull `### TODO(N.x)` blocks out of theory so the Tasks tab can show them
 * when a tile is opened. Theory itself strips these via `stripTodoSections`.
 * A heading may name several tasks (`TODO(4.1) / TODO(4.2)`); they share the body.
 */
function extractTodoBriefs(text: string): Record<string, TodoBrief> {
  const lines = text.split('\n');
  const briefs: Record<string, TodoBrief> = {};
  let currentIds: string[] = [];
  let currentFocus = '';
  let buffer: string[] = [];
  let inFence = false;

  const flush = (): void => {
    if (currentIds.length === 0) return;
    const body = buffer.join('\n').trim();
    if (!body && !currentFocus) return;
    for (const id of currentIds) {
      const prev = briefs[id];
      briefs[id] = {
        focus: currentFocus || prev?.focus || '',
        body: prev?.body ? `${prev.body}\n\n${body}`.trim() : body,
      };
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence) {
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (heading) {
        const cleaned = heading[1].replace(/`/g, '');
        const ids = [...cleaned.matchAll(/TODO\s*\((\d+\.\d+)\)/gi)].map((m) => m[1]);
        if (ids.length > 0) {
          flush();
          currentIds = ids;
          // Prefer the subtitle after the last TODO(…) on the line.
          const afterLast = cleaned.replace(/^.*TODO\s*\(\d+\.\d+\)\s*(?:[—–\-:/])?\s*/i, '');
          currentFocus = afterLast.replace(/\s*\/\s*TODO.*/i, '').trim();
          buffer = [];
          continue;
        }
        if (currentIds.length > 0) {
          flush();
          currentIds = [];
          currentFocus = '';
          buffer = [];
        }
      }
    }

    if (currentIds.length > 0) buffer.push(line);
  }
  flush();
  return briefs;
}

/**
 * Theory reads as one article but is delivered a section at a time, so a long
 * brief never lands as a single wall of text. Sections break on `##`.
 * Optional HTML comments (`mode` / `tasks`) are stripped; TODO blocks are too.
 */
function splitTheory(text: string): TheorySection[] {
  const sections: TheorySection[] = [];
  let title = '';
  let buffer: string[] = [];
  let inFence = false;

  const flush = (): void => {
    const raw = buffer.join('\n').trim();
    if (!raw) return;
    const cleaned = stripTodoSections(stripTheoryMeta(raw));
    const withoutHeading = cleaned.replace(/^##\s+.+\n?/, '').trim();
    if (!withoutHeading) return;
    sections.push({
      title: title || 'Theory',
      body: withoutHeading,
    });
  };

  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence) {
      const section = line.match(/^##\s+(.+)$/);
      if (section) {
        flush();
        title = section[1].trim();
        buffer = [line];
        continue;
      }
      const heading = line.match(/^#\s+(.+)$/);
      if (heading && !title) title = heading[1].trim();
    }

    buffer.push(line);
  }
  flush();

  return sections;
}

interface ProjectBriefColumnProps {
  persistId: string;
  content: ProjectModuleContent;
  files: Record<string, string>;
  gate: CarryPlan | null;
  isNarrow: boolean;
  onCollapse: () => void;
  onFocusFile: (path: string) => void;
  runHistory: ProjectRunHistoryEntry[];
  selectedRunId: string | null;
  onOpenRun: (runId: string) => void;
}

/**
 * Owns theory pagination/tabs so flipping parts does not re-render the editor column.
 */
const ProjectBriefColumn = React.memo(function ProjectBriefColumn({
  persistId,
  content,
  files,
  gate,
  isNarrow,
  onCollapse,
  onFocusFile,
  runHistory,
  selectedRunId,
  onOpenRun,
}: ProjectBriefColumnProps): JSX.Element {
  const [briefTab, setBriefTab] = useState<BriefTab>('theory');
  const [theoryPage, setTheoryPage] = useState(0);
  const [theoryMarkdown, setTheoryMarkdown] = useState(() =>
    loadSavedTheory(persistId, content.theory),
  );
  const [theoryEditing, setTheoryEditing] = useState(false);
  const [theoryDraft, setTheoryDraft] = useState(() =>
    loadSavedTheory(persistId, content.theory),
  );
  const [theoryCopyStatus, setTheoryCopyStatus] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const briefBodyRef = useRef<HTMLDivElement | null>(null);

  const theorySections = useMemo(() => splitTheory(theoryMarkdown), [theoryMarkdown]);
  const todoBriefs = useMemo(() => extractTodoBriefs(theoryMarkdown), [theoryMarkdown]);
  const section = theorySections[Math.min(theoryPage, theorySections.length - 1)];
  const theoryDirty = theoryMarkdown !== content.theory;

  useEffect(() => {
    const nextTheory = loadSavedTheory(persistId, content.theory);
    setBriefTab('theory');
    setTheoryPage(0);
    setTheoryMarkdown(nextTheory);
    setTheoryDraft(nextTheory);
    setTheoryEditing(false);
    setTheoryCopyStatus(null);
    setExpandedTaskId(null);
  }, [persistId, content.theory]);

  useEffect(() => {
    if (theoryPage > 0 && theoryPage >= theorySections.length) {
      setTheoryPage(Math.max(0, theorySections.length - 1));
    }
  }, [theorySections.length, theoryPage]);

  useEffect(() => {
    briefBodyRef.current?.scrollTo({ top: 0 });
  }, [theoryPage, briefTab, theoryEditing]);

  const applyTheoryDraft = useCallback((): void => {
    setTheoryMarkdown(theoryDraft);
    setTheoryPage(0);
    setTheoryEditing(false);
    setTheoryCopyStatus(null);
    try {
      const { next, legacy } = theoryStorageKeys(persistId);
      if (theoryDraft === content.theory) {
        removeMigrating(window.localStorage, next, legacy);
      } else {
        writeMigrating(window.localStorage, next, legacy, theoryDraft);
      }
    } catch {
      // ignore quota
    }
  }, [theoryDraft, content.theory, persistId]);

  const cancelTheoryEdit = useCallback((): void => {
    setTheoryDraft(theoryMarkdown);
    setTheoryEditing(false);
    setTheoryCopyStatus(null);
  }, [theoryMarkdown]);

  const resetTheoryToAuthored = useCallback((): void => {
    if (!window.confirm('Reset theory to the authored fixture? Your local rewrite will be discarded.')) {
      return;
    }
    setTheoryMarkdown(content.theory);
    setTheoryDraft(content.theory);
    setTheoryPage(0);
    setTheoryEditing(false);
    setTheoryCopyStatus(null);
    try {
      const { next, legacy } = theoryStorageKeys(persistId);
      removeMigrating(window.localStorage, next, legacy);
    } catch {
      // ignore
    }
  }, [content.theory, persistId]);

  const copyTheoryMarkdown = useCallback(async (): Promise<void> => {
    const text = theoryEditing ? theoryDraft : theoryMarkdown;
    try {
      await navigator.clipboard.writeText(text);
      setTheoryCopyStatus('Copied');
      window.setTimeout(() => setTheoryCopyStatus(null), 1600);
    } catch {
      setTheoryCopyStatus('Copy failed');
      window.setTimeout(() => setTheoryCopyStatus(null), 2000);
    }
  }, [theoryEditing, theoryDraft, theoryMarkdown]);

  return (
    <div className="col spark-brief-col">
      <div className="panel sandbox-brief-panel--solo spark-brief-panel--bare" style={{ flex: 1 }}>
        <div className="spark-brief-tabs" role="tablist" aria-label="Module sections">
          {(
            [
              ['theory', 'Theory'],
              ['tasks', 'Tasks'],
              ['runs', 'Runs'],
            ] as Array<[BriefTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={briefTab === id}
              className={`spark-brief-tab${briefTab === id ? ' active' : ''}`}
              onClick={() => setBriefTab(id)}
            >
              {label}
              {id === 'tasks' && (
                <span className="spark-brief-tab-count">{content.tasks.length}</span>
              )}
            </button>
          ))}
          {!isNarrow && (
            <button
              type="button"
              className="spark-brief-collapse-btn"
              title="Collapse theory panel"
              aria-label="Collapse theory panel"
              onClick={onCollapse}
            >
              ⟨
            </button>
          )}
        </div>

        <div
          className={`panel-body spark-brief-body${theoryEditing && briefTab === 'theory' ? ' spark-brief-body--theory-edit' : ''}`}
          ref={briefBodyRef}
        >
          {briefTab === 'theory' && theoryEditing && (
            <div className="spark-brief-admin spark-brief-admin--open project-theory-editor">
              <div className="spark-brief-admin-bar">
                <span className="spark-brief-admin-format">Theory markdown</span>
                <button
                  type="button"
                  className="spark-ide-btn spark-ide-btn--run"
                  disabled={theoryDraft === theoryMarkdown}
                  onClick={applyTheoryDraft}
                >
                  Apply
                </button>
                <button type="button" className="ghost sm" onClick={cancelTheoryEdit}>
                  Cancel
                </button>
                <button type="button" className="ghost sm" onClick={() => void copyTheoryMarkdown()}>
                  {theoryCopyStatus || 'Copy'}
                </button>
                {theoryDirty && (
                  <button type="button" className="ghost sm" onClick={resetTheoryToAuthored}>
                    Reset authored
                  </button>
                )}
              </div>
              <p className="project-theory-editor-hint">
                Edits apply in this browser. Copy the markdown into <code>theory.md</code> when you
                want it in the repo.
              </p>
              <textarea
                className="spark-brief-admin-editor"
                spellCheck={false}
                value={theoryDraft}
                onChange={(e) => setTheoryDraft(e.target.value)}
                aria-label="Theory markdown editor"
              />
            </div>
          )}

          {briefTab === 'theory' && !theoryEditing && section && (
            <div className="theory-reader">
              <h2 className="theory-section-title">{section.title}</h2>

              <MarkdownProse text={section.body} className="markdown-prose" />

              {theorySections.length > 1 && (
                <nav className="theory-pager" aria-label="Theory sections">
                  <button
                    type="button"
                    className="theory-pager-arrow"
                    disabled={theoryPage <= 0}
                    aria-label="Previous section"
                    title={
                      theoryPage > 0 ? theorySections[theoryPage - 1]?.title : undefined
                    }
                    onClick={() => setTheoryPage((page) => Math.max(0, page - 1))}
                  >
                    <span aria-hidden>‹</span>
                  </button>
                  <span className="theory-pager-status">
                    {theoryPage + 1} / {theorySections.length}
                  </span>
                  <button
                    type="button"
                    className="theory-pager-arrow"
                    disabled={theoryPage >= theorySections.length - 1}
                    aria-label="Next section"
                    title={
                      theoryPage < theorySections.length - 1
                        ? theorySections[theoryPage + 1]?.title
                        : undefined
                    }
                    onClick={() =>
                      setTheoryPage((page) => Math.min(theorySections.length - 1, page + 1))
                    }
                  >
                    <span aria-hidden>›</span>
                  </button>
                </nav>
              )}
            </div>
          )}

          {briefTab === 'theory' && !theoryEditing && !section && (
            <p className="project-task-lead">No theory sections yet.</p>
          )}

          {briefTab === 'tasks' && (
            <div className="project-task-list">
              <p className="project-task-lead">
                Everything else in the repo is written for you. Click a task for the expectation,
                then open its file — the marker disappears when you replace the block.
              </p>
              {content.tasks.map((task) => {
                const done = taskDone(files, task.file, task.id);
                const expanded = expandedTaskId === task.id;
                const brief = todoBriefs[task.id];
                return (
                  <article
                    key={task.id}
                    className={`project-task${done ? ' project-task--done' : ''}${
                      expanded ? ' project-task--expanded' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="project-task-toggle"
                      aria-expanded={expanded}
                      onClick={() => {
                        const next = expanded ? null : task.id;
                        setExpandedTaskId(next);
                        if (next) onFocusFile(task.file);
                      }}
                    >
                      <span className="project-task-id">TODO({task.id})</span>
                      <span className="project-task-body">
                        <strong className="project-task-label">{task.label}</strong>
                        <span className="project-task-summary">{task.summary}</span>
                        <code className="project-task-file">{task.file}</code>
                      </span>
                      {done ? (
                        <span className="project-task-state">done</span>
                      ) : null}
                    </button>
                    {expanded && (
                      <div className="project-task-detail">
                        {brief?.focus ? (
                          <p className="project-task-focus">
                            Implement <code>{brief.focus}</code>
                          </p>
                        ) : null}
                        {brief?.body ? (
                          <>
                            <p className="project-task-expectation-label">Expectation</p>
                            <MarkdownProse
                              text={brief.body}
                              className="markdown-prose project-task-expectation"
                            />
                          </>
                        ) : (
                          <p className="project-task-expectation-fallback">
                            Replace the <code>TODO({task.id})</code> block in{' '}
                            <code>{task.file}</code>. {task.summary}
                          </p>
                        )}
                        <button
                          type="button"
                          className="ghost sm project-task-open-file"
                          onClick={() => onFocusFile(task.file)}
                        >
                          Open {task.file}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {briefTab === 'runs' && (
            <div className="k8s-submission-table">
              {runHistory.length === 0 ? (
                <p className="k8s-submission-empty">
                  No runs yet. Use the play control above the editor.
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
                    const langTag =
                      run.language === 'python'
                        ? 'py'
                        : run.language === 'cpp'
                          ? 'cpp'
                          : run.language === 'go'
                            ? 'go'
                            : null;
                    const shortId = runShortId(run.id);
                    const when = runStamp(run.createdAt);
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
                        }${selectedRunId === run.id ? ' is-selected' : ''}`}
                        aria-label={`${attempt}, ${shortId}, ${verdict}${when ? `, ${when}` : ''}${
                          lang ? `, ${lang}` : ''
                        }`}
                        onClick={() => onOpenRun(run.id)}
                      >
                        <span className="k8s-submission-num">{attempt}</span>
                        <span
                          className="k8s-submission-sid"
                          title={lang ? `${lang} · ${run.id}` : run.id}
                        >
                          {langTag ? `${langTag}·${shortId}` : shortId}
                        </span>
                        <span className="k8s-submission-verdict">{verdict}</span>
                        <span className="k8s-submission-time">{when}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

interface ModuleWorkspaceProps {
  persistId: string;
  content: ProjectModuleContent;
  trail?: Array<{ to: string; label: string }>;
  title?: string;
  /** Rendered at the right end of the breadcrumb row. */
  crumbAction?: ReactNode;
  /** Chapters this one builds on, oldest first. Their files carry forward. */
  earlierChapters?: EarlierChapter[];
  /**
   * Shared across language variants of the same chapter so Runs survives
   * switching Go ↔ Python. Defaults to persistId.
   */
  runScopeId?: string;
  /** Language of the workspace files currently open (shown on new runs). */
  runLanguage?: LanguageId | null;
}

export function ModuleWorkspace({
  persistId,
  content,
  trail,
  title,
  crumbAction,
  earlierChapters,
  runScopeId,
  runLanguage = null,
}: ModuleWorkspaceProps): JSX.Element {
  // Callers build this list on every render; only persistId and content key a reset.
  const earlierRef = useRef(earlierChapters);
  earlierRef.current = earlierChapters;
  const historyScope = runScopeId || persistId;
  const [boot] = useState(() => startState(persistId, content, earlierChapters));
  const [files, setFiles] = useState<Record<string, string>>(boot.files);
  const [gate, setGate] = useState<CarryPlan | null>(boot.gate);
  const [note, setNote] = useState<string | null>(boot.note);
  const isNarrow = useIsNarrowUi();
  const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('brief');
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [briefWidth, setBriefWidth] = useState(() =>
    typeof window !== 'undefined'
      ? clampBriefWidth(window.innerWidth * BRIEF_RATIO, window.innerWidth)
      : 520,
  );
  const [focusFile, setFocusFile] = useState(content.entryFile);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsDrawerHeight, setLogsDrawerHeight] = useState(LOGS_DRAWER_DEFAULT);
  const [runHistory, setRunHistory] = useState<ProjectRunHistoryEntry[]>(() =>
    loadRunHistory(historyScope),
  );
  const [viewingRunId, setViewingRunId] = useState<string | null>(
    () => loadRunHistory(historyScope)[0]?.id ?? null,
  );
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<ProjectRunStatus | 'idle'>('idle');
  const [runLogs, setRunLogs] = useState(() => loadRunHistory(historyScope)[0]?.logs ?? '');

  const shellRef = useRef<HTMLDivElement | null>(null);
  const ideBodyRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const resizingLogs = useRef(false);
  const runAbortRef = useRef<AbortController | null>(null);
  const historyScopeRef = useRef(historyScope);
  historyScopeRef.current = historyScope;
  const runLanguageRef = useRef(runLanguage);
  runLanguageRef.current = runLanguage;
  const liveRunIdRef = useRef(liveRunId);
  liveRunIdRef.current = liveRunId;

  const viewingRun = runHistory.find((r) => r.id === viewingRunId) ?? runHistory[0] ?? null;
  const displayLogs =
    liveRunId && viewingRunId === liveRunId ? runLogs : viewingRun?.logs ?? runLogs;
  const hasRun = runHistory.length > 0 || Boolean(liveRunId);
  const runInFlight = runStatus === 'starting' || runStatus === 'running';
  const showLogsBar = hasRun && !logsOpen;
  const showBrief = isNarrow ? mobilePane === 'brief' : !briefCollapsed;
  const showWorkspace = isNarrow ? mobilePane === 'workspace' : true;
  const showResize = !isNarrow && !briefCollapsed;

  const patchLiveRun = useCallback(
    (patch: Partial<ProjectRunHistoryEntry> & { id: string }): void => {
      setRunHistory((prev) => {
        const existing = prev.find((r) => r.id === patch.id);
        const nextEntry: ProjectRunHistoryEntry = {
          id: patch.id,
          language: patch.language ?? existing?.language ?? runLanguageRef.current ?? null,
          status: patch.status ?? existing?.status ?? 'starting',
          logs: patch.logs ?? existing?.logs ?? '',
          createdAt: patch.createdAt ?? existing?.createdAt ?? Date.now(),
          finishedAt:
            patch.finishedAt !== undefined
              ? patch.finishedAt
              : existing?.finishedAt ?? null,
        };
        const next = upsertRunHistory(prev, nextEntry);
        saveRunHistory(historyScopeRef.current, next);
        return next;
      });
    },
    [],
  );

  // Fresh chapter (or language): reset workspace; keep Runs for the shared scope.
  useEffect(() => {
    const start = startState(persistId, content, earlierRef.current);
    setFiles(start.files);
    setGate(start.gate);
    setNote(start.note);
    setFocusFile(content.entryFile);
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setLiveRunId(null);
    setRunStatus('idle');
    setLogsOpen(false);

    const history = loadRunHistory(historyScope);
    setRunHistory(history);
    const latest = history[0] ?? null;
    setViewingRunId(latest?.id ?? null);
    setRunLogs(latest?.logs ?? '');
  }, [persistId, content, historyScope]);

  useEffect(() => {
    return () => {
      runAbortRef.current?.abort();
    };
  }, []);

  // Nothing is saved while the gate is up: a saved chapter never asks again.
  useEffect(() => {
    if (gate) return undefined;
    const t = window.setTimeout(() => {
      try {
        const { next, legacy } = workspaceFilesKeys(persistId);
        writeMigrating(window.localStorage, next, legacy, JSON.stringify(files));
      } catch {
        // Quota or private mode — losing autosave is not worth breaking the page.
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [files, persistId, gate]);

  const gateProgress = useMemo(
    () =>
      gate?.unfinished.map((chapter) => {
        const saved = readSavedFiles(chapter.persistId);
        return {
          chapter,
          done: saved ? countDone(saved, chapter.content.tasks) : null,
          total: chapter.content.tasks.length,
        };
      }) ?? [],
    [gate],
  );

  const onFocusFile = useCallback((path: string): void => {
    setFocusFile(path);
  }, []);

  const onOpenRun = useCallback((runId: string): void => {
    setViewingRunId(runId);
    const entry = runHistory.find((r) => r.id === runId);
    if (entry && entry.id !== liveRunIdRef.current) {
      setRunLogs(entry.logs);
    }
    setLogsOpen(true);
  }, [runHistory]);

  const onCollapseBrief = useCallback((): void => {
    setBriefCollapsed(true);
  }, []);

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

  const handleStopRun = useCallback((): void => {
    runAbortRef.current?.abort();
  }, []);

  const handleResetToStarter = useCallback((): void => {
    if (runInFlight) return;
    if (
      !window.confirm(
        'Reset this chapter to the starter? Your edits here are discarded. Finished earlier chapters stay as they are.',
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
    const earlier = earlierChapters ?? [];
    if (earlier.length === 0) {
      setFiles(content.files);
      setGate(null);
      setNote(null);
    } else {
      const plan = planCarry(content.files, earlier, readSavedFiles);
      if (plan.unfinished.length > 0) {
        setFiles(content.files);
        setGate(plan);
        setNote(null);
      } else {
        setFiles(plan.files);
        setGate(null);
        setNote(carryNote(plan));
      }
    }
    setFocusFile(content.entryFile);
  }, [runInFlight, persistId, earlierChapters, content.files, content.entryFile]);

  const handleRun = useCallback((): void => {
    if (runInFlight) return;
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
      language: runLanguageRef.current ?? null,
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
  }, [runInFlight, persistId, content.verify, files, patchLiveRun]);

  useEffect(() => {
    const move = (e: MouseEvent): void => onResizeMove(e);
    const up = (): void => onResizeEnd();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [onResizeMove, onResizeEnd]);

  return (
    <div className="app-page project-module-page">
      {trail && trail.length > 0 && (
        <p className="play-papers-crumb project-module-crumb">
          <span className="project-module-crumb-path">
            {trail.map((step, index) => (
              <span key={step.to}>
                {index > 0 && <span aria-hidden> / </span>}
                <Link to={step.to}>{step.label}</Link>
              </span>
            ))}
            {title && (
              <>
                <span aria-hidden> / </span>
                <span>{title}</span>
              </>
            )}
          </span>
          {crumbAction && <span className="project-module-crumb-action">{crumbAction}</span>}
        </p>
      )}
      <div
        ref={shellRef}
        className={`workspace sandbox-workspace spark-platform-workspace project-module-shell${
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
            briefLabel="Theory"
            workspaceLabel="Editor"
          />
        )}
        {showBrief && (
          <ProjectBriefColumn
            persistId={persistId}
            content={content}
            files={files}
            gate={gate}
            isNarrow={isNarrow}
            onCollapse={onCollapseBrief}
            onFocusFile={onFocusFile}
            runHistory={runHistory}
            selectedRunId={viewingRunId}
            onOpenRun={onOpenRun}
          />
        )}

        {showResize && (
          <div
            className="spark-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize theory panel"
            onMouseDown={() => {
              dragging.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            onDoubleClick={() => {
              const width = shellRef.current?.getBoundingClientRect().width || window.innerWidth;
              setBriefWidth(clampBriefWidth(width * BRIEF_RATIO, width));
            }}
          />
        )}

        {!isNarrow && briefCollapsed && (
          <button
            type="button"
            className="spark-brief-reopen-float"
            title="Show theory panel"
            aria-label="Show theory panel"
            onClick={() => setBriefCollapsed(false)}
          >
            ⟩
          </button>
        )}

        {showWorkspace && isNarrow && (
          <DesktopOnlyNotice
              tools="code editor and scratch pad"
              briefLabel="Read the theory"
              onShowBrief={() => setMobilePane('brief')}
            />
        )}
        {showWorkspace && !isNarrow && (
          <div className="col col-main">
            {gate ? (
              <div className="panel spark-ide-panel project-carry-gate" style={{ flex: 1 }}>
                <div className="project-carry-gate-card">
                  <p className="project-carry-gate-eyebrow">Chapter locked</p>
                  <h2 className="project-carry-gate-title">
                    Finish {gate.unfinished[0].label} first
                  </h2>
                  <p className="project-carry-gate-body">
                    Labs unlock in order. Complete every task in the earlier chapter
                    {gate.unfinished.length === 1 ? '' : 's'} before this one opens:
                  </p>
                  <ul className="project-carry-gate-list">
                    {gateProgress.map(({ chapter, done, total }) => (
                      <li key={chapter.id}>
                        <Link to={chapter.href}>{chapter.label}</Link>
                        <span>{done == null ? 'not started' : `${done}/${total} tasks done`}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="project-carry-gate-actions">
                    <Link className="spark-ide-btn spark-ide-btn--run" to={gate.unfinished[0].href}>
                      Go to {gate.unfinished[0].label}
                    </Link>
                  </div>
                  <p className="project-carry-gate-hint">
                    There is no skip. Pass the earlier chapter with a successful Run, then come
                    back — your code carries forward automatically.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {note && (
                  <div className="project-carry-note" role="status">
                    <span>{note}</span>
                    <button type="button" aria-label="Dismiss" onClick={() => setNote(null)}>
                      ×
                    </button>
                  </div>
                )}
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
                        aria-controls="project-logs-drawer"
                      >
                        <span>Results</span>
                        <span className="spark-results-reopen-chevron" aria-hidden>
                          ⌃
                        </span>
                      </button>
                    )}

                    {logsOpen && (
                      <div
                        id="project-logs-drawer"
                        className="spark-job-drawer spark-results-drawer project-logs-drawer"
                        style={{ height: logsDrawerHeight }}
                        role="region"
                        aria-label="Run logs"
                      >
                        <div
                          className="spark-job-drawer-resize"
                          role="separator"
                          aria-orientation="horizontal"
                          aria-label="Resize logs"
                          title="Drag to resize"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            resizingLogs.current = true;
                            document.body.style.cursor = 'row-resize';
                            document.body.style.userSelect = 'none';
                          }}
                          onDoubleClick={() => setLogsDrawerHeight(LOGS_DRAWER_DEFAULT)}
                        />
                        <div className="spark-job-drawer-header project-logs-header">
                          <span className="spark-results-tab active">Results</span>
                          {languageLabel(viewingRun?.language ?? runLanguage) && (
                            <span className="project-run-history-lang">
                              {languageLabel(viewingRun?.language ?? runLanguage)}
                            </span>
                          )}
                          <button
                            type="button"
                            className="spark-results-close"
                            title="Hide results"
                            aria-label="Hide results"
                            onClick={() => setLogsOpen(false)}
                          >
                            <span aria-hidden>⌄</span>
                          </button>
                        </div>
                        <div className="spark-job-drawer-body project-logs-body">
                          <ProjectRunProgressPanel
                            logs={displayLogs}
                            inFlight={runInFlight && viewingRunId === liveRunId}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectModulePage(): JSX.Element {
  const { projectId, moduleId } = useParams<{ projectId: string; moduleId: string }>();

  const project = getProject(projectId);
  if (!project || project.status !== 'ready') return <Navigate to={MAJORS_PATH} replace />;

  const module = getProjectModule(project, moduleId);
  if (!module) return <Navigate to={`${MAJORS_PATH}/${project.id}`} replace />;

  const content = getModuleContent(project.id, module.id);
  if (!content) return <Navigate to={`${MAJORS_PATH}/${project.id}`} replace />;

  return (
    <ModuleWorkspace
      persistId={`${project.id}.${module.id}`}
      content={content}
    />
  );
}
