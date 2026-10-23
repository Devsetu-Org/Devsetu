import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProblemStatement from './ProblemStatement';
import K8sLabFileEditor from './K8sLabFileEditor';
import BriefAdminEditor, { isEditableBriefTab } from './BriefAdminEditor';
import ChallengeVisibilityPanel from './ChallengeVisibilityPanel';
import ChallengeReviewPanel from './ChallengeReviewPanel';
import TerminalPanel from './TerminalPanel';
import SolutionGateModal, { hasAcknowledgedSolution } from './SolutionGateModal';
import ConfirmDialog from './ConfirmDialog';
import BriefBackButton from './BriefBackButton';
import WorkspaceMobileSwitcher, { type WorkspaceMobilePane } from './WorkspaceMobileSwitcher';
import DesktopOnlyNotice from './DesktopOnlyNotice';
import { IconPen, IconSubmit } from './ChromeIcons';
import { SubmitReaction, type GradeModalPhase } from './SubmitReaction';
import { useIsNarrowUi } from '../hooks/useMediaQuery';
import { fetchChallenge, fetchChallengeSolution } from '../services/challengeApi';
import { isAdminUser, isReviewStaff, getCurrentUser } from '../services/authApi';
import { readMigrating, writeMigrating } from '../utils/storageMigrate';
import {
  LAB_LEASE_RECLAIMED_EVENT,
  LAB_LEASE_TAKEN_EVENT,
  LAB_SESSION_ENDED_EVENT,
  LAB_SESSION_IDLE_EVENT,
  sendLabHeartbeat,
  withLabClientId,
} from '../services/labTabLease';
import {
  fetchK8sCapacity,
  fetchK8sSubmissions,
  gradeK8sSession,
  resetK8sSession,
  type K8sCapacityState,
  type K8sSubmissionRecord,
} from '../services/workspaceApi';
import type { ActiveSession, ChallengeFull, ChallengePublic } from '../types/domain';
import type { ProblemStatementTab } from './ProblemStatement';
import { useAppState } from '../context/AppStateContext';

interface K8sLabWorkspaceProps {
  challenge: ChallengePublic | ChallengeFull | null;
  session: ActiveSession;
  onClose: () => void;
}

const BRIEF_PCT_KEY = 'devsetu.k8sLab.briefPct.v1';
const LEGACY_BRIEF_PCT_KEY = 'devlabs.k8sLab.briefPct.v1';
/** Description share of the workspace shell (terminal gets the rest). */
const DEFAULT_BRIEF_PCT = 45;
const MIN_BRIEF_PCT = 22;
const MAX_BRIEF_PCT = 70;

function clampBriefPct(pct: number): number {
  return Math.min(MAX_BRIEF_PCT, Math.max(MIN_BRIEF_PCT, Math.round(pct)));
}

function k8sTerminalWsUrl(sessionId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/k8s-terminal?sessionId=${sessionId}`;
}

/**
 * Cluster labs (sandboxType kubernetes, linux or docker) share this workspace and the
 * kubernetes session runtime; Linux and Docker labs are a single machine with a shell.
 */
export function isKubernetesChallenge(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): boolean {
  const t = challenge?.sandboxType || '';
  return t === 'kubernetes' || t === 'linux' || t === 'docker';
}

/** Linux and Docker labs: one machine per learner, no namespace or Editor. */
export function isBoxChallenge(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): boolean {
  const t = challenge?.sandboxType || '';
  return t === 'linux' || t === 'docker';
}

export function boxMachineLabel(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): string {
  return challenge?.sandboxType === 'docker' ? 'Docker' : 'Linux';
}

type MainTab = 'terminal' | 'editor';

type EvalResult = {
  passed: boolean;
  message: string;
  stdout: string;
  stderr: string;
  at: number;
};

function submissionStamp(at: number | null): string {
  if (!at) return '';
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short id shown in the table. The full id stays on the cell for hover and the accessible name. */
function submissionShortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

type LabSubmission = K8sSubmissionRecord & { pending?: boolean };

function pendingSubmission(sessionId: string, challengeId: string, submittedAt: number): LabSubmission {
  return {
    id: 'pending',
    sessionId,
    challengeId: challengeId || null,
    name: '',
    status: 'grading',
    gradeStatus: 'grading',
    passed: false,
    message: '',
    stdout: '',
    stderr: '',
    submittedAt,
    gradedAt: null,
    pending: true,
  };
}

type GradeTask = { passed: boolean; text: string };

type GradeReport = {
  summary: string;
  tasks: GradeTask[];
  log: string;
};

/** Turn grader stdout and stderr into one sentence and the tasks that passed or failed. */
function gradeReport(result: EvalResult): GradeReport {
  const tasks: GradeTask[] = [];
  const seenFails = new Set<string>();
  const extra: string[] = [];
  const consume = (line: string) => {
    const text = line.trim();
    if (!text) return;
    const ok = text.match(/^ok:\s*(.*)$/i);
    if (ok) {
      if (ok[1]) tasks.push({ passed: true, text: ok[1] });
      return;
    }
    const failed = text.match(/^fail:\s*(.*)$/i);
    if (failed) {
      const task = failed[1];
      if (task && !seenFails.has(task)) {
        seenFails.add(task);
        tasks.push({ passed: false, text: task });
      }
      return;
    }
    if (/^PASS:/i.test(text)) return;
    extra.push(text);
  };
  result.stdout.split('\n').forEach(consume);
  result.stderr.split('\n').forEach(consume);
  let summary = result.message.trim().replace(/^(?:PASS|FAIL|fail):\s*/i, '').trim();
  if (/^(?:pass|fail)$/i.test(summary)) summary = '';
  const log = extra.filter((line) => line !== summary && !seenFails.has(line)).join('\n');
  return { summary, tasks, log };
}

function K8sResultPanel({
  result,
  submissionId,
  height,
  onClose,
  onResizeStart,
  onResizeReset,
}: {
  result: EvalResult;
  submissionId: string | null;
  height: number;
  onClose: () => void;
  onResizeStart: () => void;
  onResizeReset: () => void;
}) {
  const report = gradeReport(result);
  const shownTasks = report.tasks;
  const verdict = result.passed ? 'Accepted' : 'Wrong Answer';
  const shortId = submissionId ? submissionShortId(submissionId) : '';
  const when = submissionStamp(result.at);
  return (
    <div className="spark-job-drawer spark-results-drawer k8s-lab-result" style={{ height }}>
      <div
        className="spark-job-drawer-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize results"
        title="Drag to resize"
        onMouseDown={(e) => {
          e.preventDefault();
          onResizeStart();
        }}
        onDoubleClick={onResizeReset}
      />
      <div className="k8s-lab-result-head">
        <span className={`k8s-lab-result-verdict${result.passed ? ' is-pass' : ' is-fail'}`}>{verdict}</span>
        {shortId ? (
          <span className="k8s-lab-result-id" title={submissionId || undefined}>{shortId}</span>
        ) : null}
        <span className="k8s-lab-result-gap" />
        {when ? <span className="k8s-lab-result-time">{when}</span> : null}
        <button
          type="button"
          className="spark-results-close"
          onClick={onClose}
          title="Close results"
          aria-label="Close results"
        >
          ×
        </button>
      </div>
      <div className="k8s-lab-eval-drawer-body k8s-lab-result-body">
        {report.summary ? <p className="k8s-lab-result-summary">{report.summary}</p> : null}
        {shownTasks.length > 0 ? (
          <ul className="k8s-lab-result-checks">
            {shownTasks.map((task, index) => (
              <li key={`${task.passed ? 'ok' : 'fail'}-${index}`} className={task.passed ? 'is-pass' : 'is-fail'}>
                <span className="k8s-lab-result-mark" aria-hidden>{task.passed ? '✓' : '✗'}</span>
                <span>{task.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {result.passed && report.log ? <pre className="k8s-lab-result-log">{report.log}</pre> : null}
      </div>
    </div>
  );
}

const CAPACITY_POLL_MS = 3000;
/** Typical Karpenter node boot, shown to learners as the expected wait. */
const NODE_BOOT_SECONDS = 40;

/** Poll capacity waits (lab open held, pods waiting for a node) while the lab is open. */
function useCapacity(enabled: boolean): K8sCapacityState {
  const [state, setState] = useState<K8sCapacityState>({ waiting: [], reservingSeconds: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async (): Promise<void> => {
      try {
        const next = await fetchK8sCapacity();
        if (!cancelled) setState(next);
      } catch {
        /* keep the last value; the notice is best-effort */
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), CAPACITY_POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);
  return state;
}

function capacityEta(waitedSeconds: number): string {
  const left = NODE_BOOT_SECONDS - waitedSeconds;
  return left > 5 ? `about ${left} s` : 'a few more seconds';
}

const RESULTS_DRAWER_DEFAULT = 280;
const RESULTS_DRAWER_MIN = 140;
const RESULTS_DRAWER_MAX = 560;

export default function K8sLabWorkspace({
  challenge,
  session,
  onClose: _onClose,
}: K8sLabWorkspaceProps): JSX.Element {
  const { currentUser, onSelectChallenge } = useAppState();
  const isAdmin = isAdminUser(currentUser) || isAdminUser(getCurrentUser());
  const showReviewTab = isReviewStaff(currentUser) || isReviewStaff(getCurrentUser());
  const labReady = session.labReady !== false;
  const lockedMessage = session.lockedMessage || null;
  const idleLocked = Boolean(session.idleLocked);
  const terminalLocked = Boolean(lockedMessage) || idleLocked;
  const notReadyTitle = idleLocked
    ? 'Lab is locked because of inactivity'
    : lockedMessage
      ? 'Lab is unavailable right now'
      : 'Lab is still preparing';
  const challengeId = challenge?.id || '';
  const box = isBoxChallenge(challenge);
  const machineLabel = boxMachineLabel(challenge);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const isNarrow = useIsNarrowUi();
  const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('brief');
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [adminEditing, setAdminEditing] = useState(false);
  const [adminWantEdit, setAdminWantEdit] = useState(false);
  const [briefPct, setBriefPct] = useState(() => {
    try {
      const raw = readMigrating(sessionStorage, BRIEF_PCT_KEY, LEGACY_BRIEF_PCT_KEY);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) ? clampBriefPct(n) : DEFAULT_BRIEF_PCT;
    } catch {
      return DEFAULT_BRIEF_PCT;
    }
  });
  const [termEpoch, setTermEpoch] = useState(0);
  // Editor first so the lab is usable instantly; the terminal connects in the background.
  // Box labs (Linux, Docker) have no Editor: files are edited on the machine itself.
  const [mainTab, setMainTab] = useState<MainTab>(box ? 'terminal' : 'editor');
  const showBrief = isNarrow ? mobilePane === 'brief' : !briefCollapsed;
  const showWorkspace = isNarrow ? mobilePane === 'workspace' : true;
  const desktopOnly = isNarrow && challenge?.sandboxType !== 'linux';
  const showResize = !isNarrow && !briefCollapsed;
  const [briefTab, setBriefTab] = useState<ProblemStatementTab>('description');
  const [briefChallenge, setBriefChallenge] = useState<ChallengePublic | ChallengeFull | null>(challenge);
  const isPractice = Boolean((briefChallenge || challenge)?.k8sPlatform?.practice);
  const [solutionFiles, setSolutionFiles] = useState<Record<string, string> | null>(null);
  const [solutionEntrypoint, setSolutionEntrypoint] = useState<string | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [solutionGateOpen, setSolutionGateOpen] = useState(false);
  const [submissions, setSubmissions] = useState<LabSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsDrawerHeight, setResultsDrawerHeight] = useState(RESULTS_DRAWER_DEFAULT);
  const resizingDrawer = useRef(false);
  const [busy, setBusy] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [gradeModal, setGradeModal] = useState<GradeModalPhase | null>(null);
  const gradeModalOpen = useRef(false);
  /** True until this submit has a stored result. Closing the card before then leaves an in-progress row. */
  const gradePending = useRef(false);
  const gradeStartedAt = useRef<number | null>(null);
  const capacity = useCapacity(!box && !terminalLocked);
  const capacityWaits = capacity.waiting;
  const capacityWaitedSeconds = Math.max(
    capacity.reservingSeconds ?? 0,
    ...capacityWaits.map((w) => w.waitingSeconds),
  );
  const openingHeldForCapacity = capacity.reservingSeconds !== null || capacityWaits.length > 0;

  const wsUrl = useMemo(() => {
    if (!labReady || !session.id || session.id.startsWith('pending-k8s-')) return '';
    const base = withLabClientId(session.terminalWsUrl || k8sTerminalWsUrl(session.id));
    return `${base}&v=${termEpoch}`;
  }, [labReady, session.terminalWsUrl, session.id, termEpoch]);

  useEffect(() => {
    const onReclaimed = (): void => setTermEpoch((n) => n + 1);
    window.addEventListener(LAB_LEASE_RECLAIMED_EVENT, onReclaimed);
    return () => window.removeEventListener(LAB_LEASE_RECLAIMED_EVENT, onReclaimed);
  }, []);

  const onTerminalDisconnect = (info?: { idle?: boolean }): void => {
    if (!session.id || session.id.startsWith('pending-k8s-')) return;
    if (info?.idle) {
      window.dispatchEvent(new Event(LAB_SESSION_IDLE_EVENT));
      return;
    }
    void sendLabHeartbeat(session.id).then((result) => {
      if (result === 'taken') window.dispatchEvent(new Event(LAB_LEASE_TAKEN_EVENT));
      if (result === 'idle') window.dispatchEvent(new Event(LAB_SESSION_IDLE_EVENT));
      else if (result === 'ended') window.dispatchEvent(new Event(LAB_SESSION_ENDED_EVENT));
    });
  };

  useEffect(() => {
    if (terminalLocked) setMainTab('terminal');
  }, [terminalLocked]);

  const prevLabReady = useRef(labReady);
  useEffect(() => {
    if (labReady && !prevLabReady.current) {
      setTermEpoch((n) => n + 1);
    }
    prevLabReady.current = labReady;
  }, [labReady]);

  useEffect(() => {
    setBriefChallenge(challenge);
  }, [challenge]);

  useEffect(() => {
    if (!challenge?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const full = await fetchChallenge(challenge.id);
        if (!cancelled && full) setBriefChallenge(full);
      } catch {
        /* keep prop challenge */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge?.id]);

  useEffect(() => {
    setSolutionFiles(null);
    setSolutionEntrypoint(null);
    setSolutionLoading(false);
  }, [challenge?.id]);

  useEffect(() => {
    if (isPractice && briefTab !== 'description') setBriefTab('description');
  }, [isPractice, briefTab]);

  useEffect(() => {
    if (briefTab !== 'solution' || !challenge?.id) return;

    let cancelled = false;
    setSolutionLoading(true);
    void (async () => {
      try {
        const payload = await fetchChallengeSolution(challenge.id);
        if (cancelled) return;
        setSolutionFiles(payload.files);
        setSolutionEntrypoint(payload.entrypoint || null);
      } catch {
        // Pack write-up (problemStatement.solution) still shows — do not blank the tab.
        if (!cancelled) {
          setSolutionFiles(null);
          setSolutionEntrypoint(null);
        }
      } finally {
        if (!cancelled) setSolutionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [briefTab, challenge?.id]);

  const refreshSubmissions = () => {
    void fetchK8sSubmissions(session.id)
      .then((rows) => {
        setSubmissions((prev) => {
          const pending = prev.filter((row) => row.pending);
          return pending.length ? [...pending, ...rows] : rows;
        });
      })
      .catch(() => { /* keep last list */ });
  };

  useEffect(() => {
    setSubmissions([]);
    setSelectedSubmissionId(null);
    refreshSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    try {
      writeMigrating(sessionStorage, BRIEF_PCT_KEY, LEGACY_BRIEF_PCT_KEY, String(briefPct));
    } catch {
      /* quota */
    }
  }, [briefPct]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current && shellRef.current) {
        const rect = shellRef.current.getBoundingClientRect();
        const next = clampBriefPct(((e.clientX - rect.left) / rect.width) * 100);
        setBriefPct(next);
      }
      if (resizingDrawer.current && shellRef.current) {
        const rect = shellRef.current.getBoundingClientRect();
        const next = Math.min(
          RESULTS_DRAWER_MAX,
          Math.max(RESULTS_DRAWER_MIN, rect.bottom - e.clientY),
        );
        setResultsDrawerHeight(next);
      }
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (resizingDrawer.current) {
        resizingDrawer.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const dismissGradeModal = () => {
    const stillGrading = gradeModal === 'grading' && gradePending.current;
    gradeModalOpen.current = false;
    setGradeModal(null);
    if (!stillGrading) return;
    setSubmissions((prev) => {
      if (prev.some((row) => row.pending)) return prev;
      return [pendingSubmission(session.id, challengeId, gradeStartedAt.current ?? Date.now()), ...prev];
    });
  };

  const showEvalResult = (result: EvalResult, submissionId?: string | null, open = true) => {
    setEvalResult(result);
    if (submissionId) setSelectedSubmissionId(submissionId);
    if (open) setResultsOpen(true);
  };

  const onGrade = async () => {
    setBusy(true);
    gradeModalOpen.current = true;
    gradePending.current = true;
    gradeStartedAt.current = Date.now();
    setGradeModal('grading');
    const started = Date.now();
    const holdGrading = async () => {
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    };
    try {
      const res = await gradeK8sSession(session.id);
      const at = Date.now();
      const result: EvalResult = {
        passed: res.passed,
        message: res.message,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        at,
      };
      gradePending.current = false;
      if (res.submission) {
        setSubmissions((prev) => [
          res.submission!,
          ...prev.filter((row) => !row.pending && row.id !== res.submission!.id),
        ]);
        showEvalResult(result, res.submission.id, false);
      } else {
        setSubmissions((prev) => prev.filter((row) => !row.pending));
        refreshSubmissions();
        showEvalResult(result, null, false);
      }
      await holdGrading();
      if (gradeModalOpen.current) setGradeModal(result.passed ? 'pass' : 'fail');
    } catch (e) {
      gradePending.current = false;
      setSubmissions((prev) => prev.filter((row) => !row.pending));
      const err = e as { response?: { data?: { error?: string; message?: string; stdout?: string; stderr?: string } }; message?: string };
      const data = err?.response?.data;
      const at = Date.now();
      showEvalResult({
        passed: false,
        message: data?.error || data?.message || err.message || 'submit failed',
        stdout: data?.stdout || '',
        stderr: data?.stderr || '',
        at,
      }, null, false);
      await holdGrading();
      if (gradeModalOpen.current) setGradeModal('fail');
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setResetConfirmOpen(false);
    setBusy(true);
    gradeModalOpen.current = true;
    setGradeModal('resetting');
    const started = Date.now();
    const holdReset = async () => {
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    };
    try {
      await resetK8sSession(session.id);
      setTermEpoch((n) => n + 1);
      await holdReset();
      if (gradeModalOpen.current) setGradeModal('reset');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      showEvalResult({
        passed: false,
        message: err?.response?.data?.error || err.message || 'reset failed',
        stdout: '',
        stderr: '',
        at: Date.now(),
      });
      await holdReset();
      if (gradeModalOpen.current) setGradeModal('reset-fail');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (box) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      setMainTab((tab) => (tab === 'editor' ? 'terminal' : 'editor'));
    };
    // Capture phase: xterm swallows keystrokes once the terminal has focus.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [box]);

  const toggleHint = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘`' : 'Ctrl+`';

  return (
    <div
      ref={shellRef}
      className={`workspace sandbox-workspace spark-platform-workspace k8s-lab-workspace${
        !isNarrow && briefCollapsed ? ' spark-brief-collapsed' : ''
      }${isNarrow ? ` workspace--mobile workspace--mobile-pane-${mobilePane}` : ''}`}
      style={
        isNarrow || briefCollapsed
          ? { gridTemplateColumns: 'minmax(0, 1fr)' }
          : { gridTemplateColumns: `${briefPct}% 6px minmax(0, 1fr)` }
      }
    >
      {isNarrow && (
        <WorkspaceMobileSwitcher
          pane={mobilePane}
          onChange={setMobilePane}
          briefLabel="Brief"
          workspaceLabel="Lab"
        />
      )}
      {showBrief && (
        <div className="col spark-brief-col">
          <div className="panel sandbox-brief-panel--solo spark-brief-panel--bare" style={{ flex: 1 }}>
            <div className="spark-brief-tabs" role="tablist" aria-label="Problem sections">
              <BriefBackButton />
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'description'}
                className={`spark-brief-tab${briefTab === 'description' ? ' active' : ''}`}
                onClick={() => setBriefTab('description')}
              >
                Description
              </button>
              {!isPractice && (
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'solution'}
                className={`spark-brief-tab${briefTab === 'solution' ? ' active' : ''}`}
                onClick={() => {
                  if (hasAcknowledgedSolution(challengeId)) {
                    if (!solutionFiles) setSolutionLoading(true);
                    setBriefTab('solution');
                  } else {
                    setSolutionGateOpen(true);
                  }
                }}
              >
                Solution
              </button>
              )}
              {!isPractice && (
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'submissions'}
                className={`spark-brief-tab${briefTab === 'submissions' ? ' active' : ''}`}
                onClick={() => {
                  setBriefTab('submissions');
                  refreshSubmissions();
                }}
              >
                Submissions
                {submissions.length > 0 && (
                  <span className="spark-brief-tab-count">{submissions.length}</span>
                )}
              </button>
              )}
              {isAdmin ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={briefTab === 'visibility'}
                  className={`spark-brief-tab spark-brief-tab--setter spark-brief-tab--admin-row${briefTab === 'visibility' ? ' active' : ''}`}
                  onClick={() => setBriefTab('visibility')}
                >
                  Visibility
                </button>
              ) : null}
              {showReviewTab ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={briefTab === 'review'}
                  className={`spark-brief-tab spark-brief-tab--setter spark-brief-tab--admin-row${briefTab === 'review' ? ' active' : ''}`}
                  onClick={() => setBriefTab('review')}
                >
                  Review
                </button>
              ) : null}
              {isAdmin && isEditableBriefTab(briefTab) && !adminEditing && (
                <button
                  type="button"
                  className="spark-brief-edit-tab"
                  title="Edit this tab"
                  aria-label="Edit this tab"
                  onClick={() => setAdminWantEdit(true)}
                >
                  <IconPen />
                </button>
              )}
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
              {isAdmin && isEditableBriefTab(briefTab) && (briefChallenge || challenge) && (
                <BriefAdminEditor
                  tab={briefTab}
                  challenge={(briefChallenge || challenge)!}
                  platform={null}
                  solutionFiles={solutionFiles}
                  onEditingChange={(editing) => {
                    setAdminEditing(editing);
                    if (!editing) setAdminWantEdit(false);
                  }}
                  forceEdit={adminWantEdit}
                  onSaved={({ challenge: next, solutionFiles: files }) => {
                    setBriefChallenge(next);
                    if (files) setSolutionFiles(files);
                  }}
                />
              )}
              {adminEditing ? null : briefTab === 'visibility' && isAdmin && (briefChallenge || challenge) ? (
                <ChallengeVisibilityPanel
                  challengeId={(briefChallenge || challenge)!.id}
                  visibleTo={((briefChallenge || challenge)!.visibleTo as 'admin' | 'users' | 'reviewers') || 'admin'}
                  visibilityNotes={(briefChallenge || challenge)!.visibilityNotes || ''}
                  tokens={
                    typeof (briefChallenge || challenge)!.tokens === 'number'
                      ? (briefChallenge || challenge)!.tokens
                      : 10
                  }
                  onSaved={({ visibleTo, visibilityNotes, tokens }) => {
                    setBriefChallenge({
                      ...(briefChallenge || challenge)!,
                      visibleTo,
                      visibilityNotes,
                      tokens,
                    } as ChallengeFull);
                  }}
                />
              ) : briefTab === 'review' && showReviewTab && (briefChallenge || challenge) ? (
                <ChallengeReviewPanel challengeId={(briefChallenge || challenge)!.id} />
              ) : (
              <ProblemStatement
                challenge={briefChallenge || challenge}
                tab={briefTab}
                solutionFiles={solutionFiles}
                solutionEntrypoint={solutionEntrypoint}
                solutionLoading={solutionLoading}
                submissionsSlot={
                  briefTab === 'submissions' ? (
                    <div className="k8s-submission-table">
                      {submissions.length === 0 ? (
                        <p className="k8s-submission-empty">
                          No submissions yet. Submit grades the {box ? 'state of your machine' : 'cluster state'} for this lab.
                        </p>
                      ) : (
                        <>
                          <div className="k8s-submission-head">
                            <span>#</span>
                            <span>ID</span>
                            <span>Verdict</span>
                            <span>Submitted</span>
                          </div>
                          {submissions.map((sub, index) => {
                            const attempt = submissions.length - index;
                            const when = submissionStamp(sub.submittedAt);
                            const pending = Boolean(sub.pending);
                            const verdict = pending ? 'In Progress' : sub.passed ? 'Accepted' : 'Wrong Answer';
                            const shortId = pending ? '—' : submissionShortId(sub.id);
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                className={`k8s-submission-row${
                                  pending ? ' is-pending' : sub.passed ? ' is-pass' : ' is-fail'
                                }${selectedSubmissionId === sub.id ? ' is-selected' : ''}`}
                                aria-label={`${attempt}, ${pending ? 'in progress' : shortId}, ${verdict}${when ? `, ${when}` : ''}`}
                                aria-disabled={pending || undefined}
                                disabled={pending}
                                onClick={() => {
                                  if (pending) return;
                                  showEvalResult(
                                    {
                                      passed: sub.passed,
                                      message: sub.message,
                                      stdout: sub.stdout || '',
                                      stderr: sub.stderr || '',
                                      at: sub.submittedAt || Date.now(),
                                    },
                                    sub.id,
                                  );
                                }}
                              >
                                <span className="k8s-submission-num">{attempt}</span>
                                <span className="k8s-submission-sid" title={pending ? undefined : sub.id}>{shortId}</span>
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
          aria-label="Resize problem panel"
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          onDoubleClick={() => {
            setBriefPct(DEFAULT_BRIEF_PCT);
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

      {showWorkspace && desktopOnly && (
        <DesktopOnlyNotice tools="terminal and editor" onShowBrief={() => setMobilePane('brief')} />
      )}
      {showWorkspace && !desktopOnly && (
      <div className="col col-main">
        <div className="panel spark-ide-panel" style={{ flex: 1 }}>
          <div className="spark-ide-actionbar">
            <div className="spark-ide-actionbar-left">
              <div className="k8s-lab-main-tabs" role="tablist" aria-label="Lab workspace">
                {!box && !terminalLocked && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'editor'}
                  className={`k8s-lab-main-tab${mainTab === 'editor' ? ' active' : ''}`}
                  onClick={() => setMainTab('editor')}
                  title={`Editor (${toggleHint} to toggle)`}
                >
                  Editor
                </button>
                )}
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'terminal'}
                  className={`k8s-lab-main-tab${mainTab === 'terminal' ? ' active' : ''}`}
                  onClick={() => setMainTab('terminal')}
                  title={
                    terminalLocked
                      ? (idleLocked ? 'Terminal is locked because of inactivity' : 'Terminal is unavailable right now')
                      : labReady
                        ? (box ? 'Terminal' : `Terminal (${toggleHint} to toggle)`)
                        : 'Terminal is connecting in the background'
                  }
                >
                  Terminal
                  <span
                    className={`k8s-lab-term-status${labReady && !terminalLocked ? ' is-ready' : ''}${terminalLocked ? ' is-locked' : ''}`}
                    aria-label={terminalLocked ? 'unavailable' : labReady ? 'ready' : 'connecting'}
                  />
                </button>
              </div>
            </div>
            <div className="spark-ide-actionbar-right">
              <button
                type="button"
                className="spark-ide-btn spark-ide-btn--run"
                disabled={busy || !labReady}
                onClick={() => setResetConfirmOpen(true)}
                title={
                  !labReady
                    ? notReadyTitle
                    : box ? 'Start over on a fresh machine' : 'Reset workloads in your namespace'
                }
              >
                Reset
              </button>
              {isPractice ? (
                <span
                  className="k8s-lab-practice-chip"
                  title="Hands-on practice: explore freely, there is nothing to submit"
                >
                  Practice lab · no submission
                </span>
              ) : (
                <button
                  type="button"
                  className="spark-ide-btn spark-ide-btn--submit"
                  disabled={busy || !labReady}
                  onClick={() => void onGrade()}
                  title={labReady ? 'Submit for grading' : notReadyTitle}
                >
                  <IconSubmit color="#04120c" />
                  <span>{busy ? 'Submitting…' : 'Submit'}</span>
                </button>
              )}
            </div>
          </div>

          <div
            className={[
              'panel-body flush k8s-lab-term-pane',
              resultsOpen && evalResult ? 'k8s-lab-term-pane--results-open' : '',
              !resultsOpen && evalResult ? 'k8s-lab-term-pane--has-results-bar' : '',
            ].filter(Boolean).join(' ')}
            style={
              resultsOpen && evalResult
                ? ({ '--k8s-results-h': `${resultsDrawerHeight}px` } as React.CSSProperties)
                : undefined
            }
          >
            <div
              className={`k8s-lab-term-pane-layer${mainTab === 'terminal' ? ' is-active' : ''}`}
              aria-hidden={mainTab !== 'terminal'}
            >
              {terminalLocked ? (
                <div className="k8s-lab-locked" role="status" aria-live="polite">
                  <svg className="k8s-lab-locked-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                    <rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <strong>{idleLocked ? 'This lab is locked' : 'This lab is locked for now'}</strong>
                  <p>
                    {idleLocked
                      ? (box
                        ? 'It was locked because of inactivity, so the machine was stopped. Your files were kept.'
                        : 'It was locked because of inactivity, so the lab was paused.')
                      : lockedMessage}
                  </p>
                  <p className="k8s-lab-locked-hint">
                    {idleLocked
                      ? (box
                        ? 'Resume starts the machine again with your files on it. You can still read the description and the rest of the brief on the left.'
                        : 'Resume brings your lab back. You can still read the description and the rest of the brief on the left.')
                      : 'You can still read the description and the rest of the brief on the left.'}
                  </p>
                  {challenge && (
                    <button
                      type="button"
                      className="spark-ide-btn k8s-lab-locked-retry"
                      onClick={() => void onSelectChallenge(challenge)}
                    >
                      {idleLocked ? 'Click here to resume your session' : 'Try again'}
                    </button>
                  )}
                </div>
              ) : !labReady ? (
                <div className="k8s-lab-terminal-warming" role="status" aria-live="polite">
                  <span className="spinner" />
                  <div>
                    {box ? (
                      <>
                        <strong>Starting your {machineLabel} machine…</strong>
                        <p>
                          A fresh machine is booting for you. This usually takes a few seconds, and up to
                          two minutes when a new server has to start first.
                        </p>
                      </>
                    ) : openingHeldForCapacity ? (
                      <>
                        <strong>Adding cluster capacity for your lab…</strong>
                        <p>
                          The cluster is busy, so a node is starting for your lab&apos;s pods
                          ({capacityEta(capacityWaitedSeconds)}). The shell opens here as soon as they are placed.
                        </p>
                      </>
                    ) : (
                      <>
                        <strong>Preparing your cluster terminal…</strong>
                        <p>
                          Keep drafting in the Editor — the shell opens here as soon as your namespace is ready.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {capacityWaits.length > 0 && (
                    <div className="k8s-lab-capacity-notice" role="status" aria-live="polite">
                      <span className="spinner" />
                      <span>
                        Starting extra capacity for{' '}
                        <code>{capacityWaits.map((w) => w.pod).join(', ')}</code>
                        {' '}— {capacityEta(capacityWaitedSeconds)}. Your lab&apos;s reserved pods are in use;
                        this starts automatically and your other pods are unaffected.
                      </span>
                    </div>
                  )}
                  <TerminalPanel
                    wsUrl={wsUrl}
                    isActive={mainTab === 'terminal'}
                    resizeProtocol
                    onDisconnect={onTerminalDisconnect}
                  />
                </>
              )}
            </div>
            {!box && (
            <div
              className={`k8s-lab-scratch${mainTab === 'editor' ? ' is-active' : ''}`}
              aria-hidden={mainTab !== 'editor'}
            >
              <K8sLabFileEditor
                sessionId={session.id}
                challengeId={challengeId}
                labReady={labReady}
                active={mainTab === 'editor'}
                toggleHint={toggleHint}
              />
            </div>
            )}

            {!resultsOpen && evalResult && (
              <button
                type="button"
                className="spark-results-reopen k8s-lab-result-reopen"
                onClick={() => setResultsOpen(true)}
                title="Show result"
              >
                <span className={`k8s-lab-result-verdict${evalResult.passed ? ' is-pass' : ' is-fail'}`}>
                  {evalResult.passed ? 'Accepted' : 'Wrong Answer'}
                </span>
                <span className="k8s-lab-result-reopen-note">{gradeReport(evalResult).summary}</span>
                <span className="spark-results-reopen-chevron" aria-hidden>
                  ⌃
                </span>
              </button>
            )}

            {resultsOpen && evalResult && (
              <K8sResultPanel
                result={evalResult}
                submissionId={selectedSubmissionId}
                height={resultsDrawerHeight}
                onClose={() => setResultsOpen(false)}
                onResizeStart={() => {
                  resizingDrawer.current = true;
                  document.body.style.cursor = 'row-resize';
                  document.body.style.userSelect = 'none';
                }}
                onResizeReset={() => setResultsDrawerHeight(RESULTS_DRAWER_DEFAULT)}
              />
            )}
          </div>
        </div>
      </div>
      )}
      {gradeModal && <SubmitReaction phase={gradeModal} onClose={dismissGradeModal} />}
      <SolutionGateModal
        open={solutionGateOpen}
        challengeId={challengeId}
        onCancel={() => setSolutionGateOpen(false)}
        onConfirm={() => {
          setSolutionGateOpen(false);
          if (!solutionFiles) setSolutionLoading(true);
          setBriefTab('solution');
        }}
      />
      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset this lab?"
        confirmLabel="Reset lab"
        cancelLabel="Cancel"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => void onReset()}
      >
        {box ? (
          <p>
            Your machine is replaced with a fresh one and the lab&apos;s starting state is set up again.
            Everything you changed on it, including files in your home folder, is lost.
          </p>
        ) : (
          <>
            <p>
              Everything running in your namespace is wiped (Pods, Deployments, Services, ConfigMaps,
              volumes, …) and the lab&apos;s starting state is set up again.
            </p>
            <p>
              Your code and config files are <strong>not</strong> touched. Anything you created in the
              Editor or your home folder stays, so you can <code>kubectl apply -f</code> it again.
            </p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
