import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import MarkdownProse from '../components/MarkdownProse';
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
  type CarryPlan,
  type EarlierChapter,
  joinLabels,
  ownedFiles,
  planCarry,
  withReference,
} from '../utils/chapterCarry';
import { readMigrating, removeMigrating, writeMigrating } from '../utils/storageMigrate';
import { countDone, readSavedFiles, taskDone, workspaceFilesKeys } from '../utils/workspaceFiles';

type BriefTab = 'theory' | 'tasks' | 'verify';

const BRIEF_MIN = 320;
const BRIEF_RATIO = 0.42;
const BRIEF_MAX_RATIO = 0.62;

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
  parts.push('Their tests still run here, so a bug in earlier code shows up in this chapter too.');
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

const DEFAULT_VERIFY_LEAD =
  'Run these from the project root. The tests talk to your server over a real socket, so passing them means the thing actually works.';

interface TheorySection {
  title: string;
  body: string;
  mode: 'read-only' | 'read-and-implement';
  taskIds: string[];
}

const MODE_META =
  /^<!--\s*mode:\s*(read-only|read-and-implement)(?:\s+tasks:([\d.,\s]+))?\s*-->\s*$/m;

function parseTheoryMode(body: string): {
  body: string;
  mode: TheorySection['mode'];
  taskIds: string[];
} {
  const match = body.match(MODE_META);
  if (!match) {
    return { body: body.trim(), mode: 'read-only', taskIds: [] };
  }
  const mode = match[1] as TheorySection['mode'];
  const taskIds = (match[2] || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const cleaned = body.replace(MODE_META, '').trim();
  return { body: cleaned, mode, taskIds };
}

/**
 * Theory reads as one article but is delivered a section at a time, so a long
 * brief never lands as a single wall of text. Sections break on `##`.
 * Optional HTML comment under the heading: `<!-- mode: read-only -->` or
 * `<!-- mode: read-and-implement tasks:1.1,1.2 -->`.
 */
function splitTheory(text: string): TheorySection[] {
  const sections: TheorySection[] = [];
  let title = '';
  let buffer: string[] = [];
  let inFence = false;

  const flush = (): void => {
    const raw = buffer.join('\n').trim();
    if (!raw) return;
    const parsed = parseTheoryMode(raw);
    const withoutHeading = parsed.body.replace(/^##\s+.+\n?/, '').trim();
    if (!withoutHeading) return;
    sections.push({
      title: title || 'Theory',
      body: withoutHeading,
      mode: parsed.mode,
      taskIds: parsed.taskIds,
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

interface ModuleWorkspaceProps {
  persistId: string;
  content: ProjectModuleContent;
  trail?: Array<{ to: string; label: string }>;
  title?: string;
  /** Rendered at the right end of the breadcrumb row. */
  crumbAction?: ReactNode;
  /** Chapters this one builds on, oldest first. Their files carry forward. */
  earlierChapters?: EarlierChapter[];
}

export function ModuleWorkspace({
  persistId,
  content,
  trail,
  title,
  crumbAction,
  earlierChapters,
}: ModuleWorkspaceProps): JSX.Element {
  // Callers build this list on every render; only persistId and content key a reset.
  const earlierRef = useRef(earlierChapters);
  earlierRef.current = earlierChapters;
  const [boot] = useState(() => startState(persistId, content, earlierChapters));
  const [files, setFiles] = useState<Record<string, string>>(boot.files);
  const [gate, setGate] = useState<CarryPlan | null>(boot.gate);
  const [note, setNote] = useState<string | null>(boot.note);
  const [earlierMenuOpen, setEarlierMenuOpen] = useState(false);
  const earlierMenuRef = useRef<HTMLDivElement | null>(null);
  const [briefTab, setBriefTab] = useState<BriefTab>('theory');
  const [theoryPage, setTheoryPage] = useState(0);
  const isNarrow = useIsNarrowUi();
  const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('brief');
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [briefWidth, setBriefWidth] = useState(() =>
    typeof window !== 'undefined'
      ? clampBriefWidth(window.innerWidth * BRIEF_RATIO, window.innerWidth)
      : 520,
  );
  const [focusFile, setFocusFile] = useState(content.entryFile);
  const [theoryMarkdown, setTheoryMarkdown] = useState(() =>
    loadSavedTheory(persistId, content.theory),
  );
  const [theoryEditing, setTheoryEditing] = useState(false);
  const [theoryDraft, setTheoryDraft] = useState(() =>
    loadSavedTheory(persistId, content.theory),
  );
  const [theoryCopyStatus, setTheoryCopyStatus] = useState<string | null>(null);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const briefBodyRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const showBrief = isNarrow ? mobilePane === 'brief' : !briefCollapsed;
  const showWorkspace = isNarrow ? mobilePane === 'workspace' : true;
  const showResize = !isNarrow && !briefCollapsed;

  const theorySections = useMemo(() => splitTheory(theoryMarkdown), [theoryMarkdown]);
  const section = theorySections[Math.min(theoryPage, theorySections.length - 1)];
  const theoryDirty = theoryMarkdown !== content.theory;

  // Fresh module: reset every piece of per-module state.
  useEffect(() => {
    const nextTheory = loadSavedTheory(persistId, content.theory);
    const start = startState(persistId, content, earlierRef.current);
    setFiles(start.files);
    setGate(start.gate);
    setNote(start.note);
    setEarlierMenuOpen(false);
    setFocusFile(content.entryFile);
    setBriefTab('theory');
    setTheoryPage(0);
    setTheoryMarkdown(nextTheory);
    setTheoryDraft(nextTheory);
    setTheoryEditing(false);
    setTheoryCopyStatus(null);
  }, [persistId, content]);

  // Keep page in range when theory sections change after an edit.
  useEffect(() => {
    if (theoryPage > 0 && theoryPage >= theorySections.length) {
      setTheoryPage(Math.max(0, theorySections.length - 1));
    }
  }, [theorySections.length, theoryPage]);

  // A new section starts at its own beginning, not where the last one ended.
  useEffect(() => {
    briefBodyRef.current?.scrollTo({ top: 0 });
  }, [theoryPage, briefTab, theoryEditing]);

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

  useEffect(() => {
    if (!earlierMenuOpen) return undefined;
    const close = (e: MouseEvent): void => {
      if (!earlierMenuRef.current?.contains(e.target as Node)) setEarlierMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [earlierMenuOpen]);

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

  function startWithReference(): void {
    if (!gate) return;
    setFiles(gate.files);
    setNote(carryNote(gate));
    setGate(null);
  }

  function pullEarlierCode(): void {
    const earlier = earlierChapters ?? [];
    setEarlierMenuOpen(false);
    if (
      !window.confirm(
        'Replace the earlier chapters’ files here with your latest finished code from those chapters? Changes you made to those files in this chapter are overwritten.',
      )
    ) {
      return;
    }
    const plan = planCarry(content.files, earlier, readSavedFiles);
    const next = { ...files };
    for (const chapter of plan.fromLearner) {
      for (const path of ownedFiles(chapter)) {
        if (path in plan.files) next[path] = plan.files[path];
      }
    }
    setFiles(next);
    if (plan.fromLearner.length === 0) {
      setNote('None of the earlier chapters is finished in this browser yet, so nothing changed.');
    } else {
      const kept =
        plan.unfinished.length > 0
          ? ` ${joinLabels(plan.unfinished)} ${plan.unfinished.length === 1 ? 'is' : 'are'} not finished, so ${plan.unfinished.length === 1 ? 'it keeps' : 'they keep'} the code it had here.`
          : '';
      setNote(`Pulled in your latest code from ${joinLabels(plan.fromLearner)}.${kept}`);
    }
  }

  function swapInReference(): void {
    const earlier = earlierChapters ?? [];
    setEarlierMenuOpen(false);
    if (
      !window.confirm(
        'Replace the earlier chapters’ files with the reference solution? It shows the answers to their tasks. Your work on this chapter’s tasks is kept.',
      )
    ) {
      return;
    }
    setFiles(withReference(files, content.files, earlier));
    setNote(`${joinLabels(earlier)} now ${earlier.length === 1 ? 'uses' : 'use'} the reference solution.`);
  }

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

  const onResizeMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    setBriefWidth(clampBriefWidth(e.clientX - rect.left, rect.width));
  }, []);

  const onResizeEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

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

  const doneCount = content.tasks.filter((t) => taskDone(files, t.file, t.id)).length;

  function resetModule(): void {
    const message = earlierChapters?.length
      ? 'Reset this chapter? Your edits here are discarded, and it starts again from your finished earlier chapters.'
      : 'Reset this module? Your edits will be discarded.';
    if (!window.confirm(message)) return;
    const filesKeys = workspaceFilesKeys(persistId);
    const theoryKeys = theoryStorageKeys(persistId);
    try {
      removeMigrating(window.localStorage, filesKeys.next, filesKeys.legacy);
      removeMigrating(window.localStorage, theoryKeys.next, theoryKeys.legacy);
    } catch {
      // ignore
    }
    const start = startState(persistId, content, earlierChapters);
    setFiles(start.files);
    setGate(start.gate);
    setNote(start.note);
    setFocusFile(content.entryFile);
    setTheoryMarkdown(content.theory);
    setTheoryDraft(content.theory);
    setTheoryPage(0);
    setTheoryEditing(false);
    setTheoryCopyStatus(null);
  }

  return (
    <div className="app-page project-module-page">
      {trail && trail.length > 0 && (
        <p className="play-papers-crumb project-module-crumb">
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
          <div className="col spark-brief-col">
            <div
              className="panel sandbox-brief-panel--solo spark-brief-panel--bare"
              style={{ flex: 1 }}
            >
              <div className="spark-brief-tabs" role="tablist" aria-label="Module sections">
                {(
                  [
                    ['theory', 'Theory'],
                    ['tasks', 'Tasks'],
                    ['verify', 'Verify'],
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
                <div className="project-module-tab-actions">
                  <span className="project-module-progress" title="Blocks with the TODO marker removed">
                    {doneCount}/{content.tasks.length} blocks
                  </span>
                  {briefTab === 'theory' && !theoryEditing && (
                    <button
                      type="button"
                      className="topnav-pill topnav-action"
                      title="Edit theory markdown"
                      onClick={() => {
                        setTheoryDraft(theoryMarkdown);
                        setTheoryEditing(true);
                        setTheoryCopyStatus(null);
                      }}
                    >
                      Edit
                      {theoryDirty ? ' •' : ''}
                    </button>
                  )}
                  {earlierChapters && earlierChapters.length > 0 && !gate && (
                    <div className="project-earlier-menu" ref={earlierMenuRef}>
                      <button
                        type="button"
                        className="topnav-pill topnav-action"
                        aria-haspopup="menu"
                        aria-expanded={earlierMenuOpen}
                        title="Code from the chapters this one builds on"
                        onClick={() => setEarlierMenuOpen((open) => !open)}
                      >
                        Earlier code ▾
                      </button>
                      {earlierMenuOpen && (
                        <div className="project-earlier-menu-list" role="menu">
                          <button type="button" role="menuitem" onClick={pullEarlierCode}>
                            <strong>Pull in my latest code</strong>
                            <span>From each finished earlier chapter</span>
                          </button>
                          <button type="button" role="menuitem" onClick={swapInReference}>
                            <strong>Use the reference solution</strong>
                            <span>Shows the answers to earlier chapters</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button type="button" className="topnav-pill topnav-action" onClick={resetModule}>
                    Reset
                  </button>
                </div>
                {!isNarrow && (
                  <button
                    type="button"
                    className="spark-brief-collapse-btn"
                    title="Collapse theory panel"
                    aria-label="Collapse theory panel"
                    onClick={() => setBriefCollapsed(true)}
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
                      Edits apply in this browser. Copy the markdown into{' '}
                      <code>theory.md</code> when you want it in the repo.
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
                    <div className="theory-section-head">
                      {theorySections.length > 1 && (
                        <p className="theory-eyebrow">
                          Part {theoryPage + 1} of {theorySections.length}
                        </p>
                      )}
                      <span
                        className={`theory-mode-badge theory-mode-badge--${
                          section.mode === 'read-and-implement' ? 'implement' : 'read'
                        }`}
                      >
                        {section.mode === 'read-and-implement'
                          ? 'Read and Implement'
                          : 'Read only'}
                      </span>
                    </div>

                    <h2 className="theory-section-title">{section.title}</h2>

                    <MarkdownProse text={section.body} className="markdown-prose" />

                    {section.mode === 'read-and-implement' && section.taskIds.length > 0 && (
                      <div className="theory-implement-callout">
                        <p className="theory-implement-lead">
                          Complete these tasks in the repo, then continue.
                        </p>
                        <ul className="theory-implement-tasks">
                          {section.taskIds.map((id) => {
                            const task = content.tasks.find((t) => t.id === id);
                            if (!task) return null;
                            const done = taskDone(files, task.file, task.id);
                            return (
                              <li key={id}>
                                <button
                                  type="button"
                                  className={`theory-implement-task${done ? ' is-done' : ''}`}
                                  onClick={() => {
                                    setBriefTab('tasks');
                                    setFocusFile(task.file);
                                  }}
                                >
                                  <span>TODO({task.id})</span>
                                  <strong>{task.label}</strong>
                                  <span>{done ? 'done' : 'open'}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {theorySections.length > 1 && (
                      <nav className="theory-pager" aria-label="Theory sections">
                        <button
                          type="button"
                          className="theory-pager-arrow"
                          disabled={theoryPage <= 0}
                          aria-label="Previous section"
                          title={
                            theoryPage > 0
                              ? theorySections[theoryPage - 1]?.title
                              : undefined
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
                            setTheoryPage((page) =>
                              Math.min(theorySections.length - 1, page + 1),
                            )
                          }
                        >
                          <span aria-hidden>›</span>
                        </button>
                      </nav>
                    )}
                  </div>
                )}

                {briefTab === 'theory' && !theoryEditing && !section && (
                  <p className="project-task-lead">No theory sections yet. Click Edit to add markdown.</p>
                )}

                {briefTab === 'tasks' && (
                  <div className="project-task-list">
                    <p className="project-task-lead">
                      Everything else in the repo is written for you. Open a task to jump to its
                      file — the marker disappears when you replace the block.
                    </p>
                    {content.tasks.map((task) => {
                      const done = taskDone(files, task.file, task.id);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`project-task${done ? ' project-task--done' : ''}`}
                          onClick={() => setFocusFile(task.file)}
                        >
                          <span className="project-task-id">TODO({task.id})</span>
                          <span className="project-task-body">
                            <strong className="project-task-label">{task.label}</strong>
                            <span className="project-task-summary">{task.summary}</span>
                            <code className="project-task-file">{task.file}</code>
                          </span>
                          <span className="project-task-state">{done ? 'done' : 'open'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {briefTab === 'verify' && (
                  <div className="project-verify">
                    <p className="project-task-lead">{content.verifyLead ?? DEFAULT_VERIFY_LEAD}</p>
                    <ul className="project-verify-list">
                      {content.verify.map((cmd) => (
                        <li key={cmd}>
                          <code>{cmd}</code>
                        </li>
                      ))}
                    </ul>
                    <p className="project-verify-note">
                      There is no runner attached to project modules yet, so run them in your own
                      terminal. Your edits here are saved in this browser.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
                  <p className="project-carry-gate-eyebrow">Builds on earlier chapters</p>
                  <h2 className="project-carry-gate-title">
                    Finish {gate.unfinished[0].label} first
                  </h2>
                  <p className="project-carry-gate-body">
                    This chapter starts from your own code for the chapters before it.{' '}
                    {gate.unfinished.length === 1 ? 'This one is' : 'These are'} not finished in
                    this browser yet:
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
                    <button type="button" className="ghost sm" onClick={startWithReference}>
                      Start with the reference for {gate.unfinished.length === 1 ? 'it' : 'them'}
                    </button>
                  </div>
                  <p className="project-carry-gate-hint">
                    The reference is our solution to those tasks. Once you finish them yourself,
                    bring your code in from Earlier code, Pull in my latest code.
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
                  <SparkProjectEditor
                    key={`${persistId}:${focusFile}`}
                    files={files}
                    onChangeFiles={setFiles}
                    entryFile={focusFile}
                  />
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
