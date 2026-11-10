import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import K8sLabFileEditor from './K8sLabFileEditor';
import BriefAdminEditor, { isEditableBriefTab } from './BriefAdminEditor';
import ChallengeVisibilityPanel from './ChallengeVisibilityPanel';
import ChallengeReviewPanel from './ChallengeReviewPanel';
import TerminalPanel from './TerminalPanel';
import SparkClusterDiagram from './SparkClusterDiagram';
import SparkInvestigationForm, {
  loadInvestigation,
  saveInvestigation,
  sparkInvestigation,
} from './SparkInvestigationForm';
import SolutionGateModal, { hasAcknowledgedSolution } from './SolutionGateModal';
import ConfirmDialog from './ConfirmDialog';
import BriefBackButton from './BriefBackButton';
import WorkspaceMobileSwitcher, { type WorkspaceMobilePane } from './WorkspaceMobileSwitcher';
import DesktopOnlyNotice from './DesktopOnlyNotice';
import { IconClock, IconPen, IconReset, IconSave, IconSubmit } from './ChromeIcons';
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
  LAB_TIME_LEFT_EVENT,
  sendLabHeartbeat,
  withLabClientId,
  type LabTimeLeftDetail,
} from '../services/labTabLease';
import {
  fetchK8sCapacity,
  fetchChallengeK8sSubmissions,
  fetchK8sSubmissions,
  fetchLabBootPhase,
  fetchLabProgress,
  gradeK8sSession,
  resetK8sSession,
  saveLabProgress,
  type K8sCapacityState,
  type K8sSubmissionRecord,
  type LabBootPhase,
  type LabProgressStatus,
} from '../services/workspaceApi';
import type { ActiveSession, ChallengeFull, ChallengePublic } from '../types/domain';
import ProblemStatement, { challengeGuideText, type ProblemStatementTab } from './ProblemStatement';
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

/** Procured DevSetu hosts. Role is not in the hostname. */
const SPARK_NODES = [
  { id: 'ds-spark-01', label: 'ds-spark-01', role: 'master' as const, ui: 'ds-spark-01', clusterUi: 'http://ds-spark-01:8080' },
  { id: 'ds-spark-02', label: 'ds-spark-02', role: 'worker' as const, ui: 'ds-spark-02', clusterUi: 'http://ds-spark-02:8081' },
  { id: 'ds-spark-03', label: 'ds-spark-03', role: 'worker' as const, ui: 'ds-spark-03', clusterUi: 'http://ds-spark-03:8082' },
  { id: 'ds-spark-04', label: 'ds-spark-04', role: 'worker' as const, ui: 'ds-spark-04', clusterUi: 'http://ds-spark-04:8083' },
];
/** Chapter 2 YARN: RM + NodeManagers + shell submit client. */
const YARN_2 = [
  { id: 'shell', label: 'shell', role: 'shell' as const, ui: '', clusterUi: '' },
  { id: 'ds-spark-01', label: 'ds-spark-01', role: 'rm' as const, ui: 'ds-spark-01', clusterUi: 'http://ds-spark-01:8088' },
  { id: 'ds-spark-02', label: 'ds-spark-02', role: 'nm' as const, ui: 'ds-spark-02', clusterUi: 'http://ds-spark-02:8042' },
  { id: 'ds-spark-03', label: 'ds-spark-03', role: 'nm' as const, ui: 'ds-spark-03', clusterUi: 'http://ds-spark-03:8042' },
];
/** Chapter 1 foundations labs: three procured hosts (01 master, 02–03 workers). */
const SPARK_2 = SPARK_NODES.slice(0, 3);
/** Lab 1.3: submit from shell (client driver) + Application UI on shell:4040. */
const SPARK_2_TRACE = [
  { id: 'shell', label: 'shell', role: 'shell' as const, ui: '', clusterUi: '' },
  ...SPARK_2,
  {
    id: 'shell-app',
    label: 'shell',
    role: 'driver' as const,
    ui: 'shell',
    clusterUi: 'http://shell:4040',
  },
];
type SparkLabNode =
  | (typeof SPARK_NODES)[number]
  | (typeof YARN_2)[number]
  | (typeof SPARK_2_TRACE)[number];
const SPARK_LAB_NODES: Record<string, SparkLabNode[]> = {
  'spark-01-stand-up-the-cluster-and-find-everything-on-disk': SPARK_2,
  'spark-02-read-the-master-ui-and-a-worker-ui-as-instruments': SPARK_2,
  'spark-03-trace-a-job-from-submission-to-last-task': SPARK_2_TRACE,
  'spark-04-find-where-the-data-actually-lives': SPARK_2,
  'spark-05-the-executor-memory-map': SPARK_2,
  'spark-06-diagnose-an-executor-lost-to-memory-pressure': SPARK_2,
  'spark-07-the-capstone-bug-slow-then-dead': SPARK_2,
  'spark-08-drain-a-worker-without-breaking-anything': SPARK_2,
  'spark-09-submit-the-same-workload-on-yarn': YARN_2,
};

function sparkUiKindLabel(role: SparkLabNode['role']): string {
  if (role === 'rm') return 'ResourceManager UI';
  if (role === 'nm') return 'NodeManager UI';
  if (role === 'shell') return 'Submit client';
  if (role === 'driver') return 'Application UI';
  if (role === 'master') return 'Master UI';
  return 'Worker UI';
}

function sparkUiPortLabel(clusterUi: string): string {
  const match = /:(\d+)\s*$/.exec(clusterUi);
  return match ? `:${match[1]}` : clusterUi;
}

function sparkUiNodes(nodes: SparkLabNode[]): SparkLabNode[] {
  return nodes.filter((node) => node.role !== 'shell' && Boolean(node.ui));
}

/** Terminal knobs — Application UI rows are dashboards, not shells. */
function sparkShellNodes(nodes: SparkLabNode[]): SparkLabNode[] {
  return nodes.filter((node) => node.role !== 'driver');
}

/** Pulse map — Master + Workers only (shell is a submit client, not a cluster node). */
function sparkDiagramNodes(nodes: SparkLabNode[]): SparkLabNode[] {
  return nodes.filter((node) => node.role === 'master' || node.role === 'worker' || node.role === 'rm' || node.role === 'nm');
}

function SparkUiChoice({
  nodes,
  sessionId,
  onClose,
}: {
  nodes: SparkLabNode[];
  sessionId: string;
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="grade-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="grade-modal spark-ui-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spark-ui-choice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="grade-modal-head">
          <div>
            <h2 id="spark-ui-choice-title">Open a dashboard</h2>
            <p className="grade-modal-sub">
              Port-forwarded to your laptop — not reachable directly from the browser.
            </p>
          </div>
          <button type="button" className="grade-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="spark-ui-choice-list">
          {sparkUiNodes(nodes).map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                window.open(`/api/session/${sessionId}/spark-ui/${node.ui}/`, '_blank', 'noopener,noreferrer');
                onClose();
              }}
            >
              <span className="spark-ui-choice-kind">{sparkUiKindLabel(node.role)}</span>
              <span className="spark-ui-choice-dot" aria-hidden="true">·</span>
              <span className="spark-ui-choice-host">{node.label}</span>
              <span className="spark-ui-choice-dot" aria-hidden="true">·</span>
              <span className="spark-ui-choice-url">{sparkUiPortLabel(node.clusterUi)}</span>
            </button>
          ))}
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SparkLabKnobs({
  nodes,
  selected,
  onPick,
}: {
  nodes: SparkLabNode[];
  selected: string | null;
  onPick: (id: string) => void;
}): JSX.Element {
  return (
    <div className="spark-node-knobs" role="group" aria-label="Cluster nodes">
      {nodes.map((node, index) => (
        <React.Fragment key={node.id}>
          {index > 0 ? <span className="spark-node-sep" aria-hidden="true">|</span> : null}
          <button
            type="button"
            className={`spark-node-knob${selected === node.id ? ' is-on' : ''}`}
            aria-pressed={selected === node.id}
            onClick={() => onPick(node.id)}
          >
            {node.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function k8sTerminalWsUrl(sessionId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/k8s-terminal?sessionId=${sessionId}`;
}

/**
 * Cluster labs (sandboxType kubernetes, linux, docker, kafka, spark, or k8s-platform)
 * share this workspace and the kubernetes session runtime. Linux, Docker, Kafka,
 * Spark, and Kubernetes platform labs are a shell with no Editor.
 */
export function isKubernetesChallenge(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): boolean {
  const t = challenge?.sandboxType || '';
  return t === 'kubernetes' || t === 'linux' || t === 'docker' || t === 'kafka' || t === 'spark' || t === 'k8s-platform';
}

/** Linux, Docker, Kafka, Spark, and Kubernetes platform labs: one machine per learner, no Editor. */
export function isBoxChallenge(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): boolean {
  const t = challenge?.sandboxType || '';
  return t === 'linux' || t === 'docker' || t === 'kafka' || t === 'spark' || t === 'k8s-platform';
}

export function boxMachineLabel(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): string {
  if (challenge?.sandboxType === 'docker') return 'Docker';
  if (challenge?.sandboxType === 'kafka') return 'Kafka';
  if (challenge?.sandboxType === 'spark') return 'Spark';
  if (challenge?.sandboxType === 'k8s-platform') return 'Kubernetes';
  return 'Linux';
}

/** Shown on the locked terminal for public users until live labs ship. */
export const LAB_COMING_SOON_MSG = 'Coming soon';

/**
 * Public (non-admin) users cannot start Linux, Docker, Kubernetes, Kafka, Spark, or platform
 * terminals yet. Admins may open the start path for testing when the pool is
 * up — but pool capacity still applies to admins the same as everyone else.
 * This gate is only Coming soon, never a capacity bypass.
 */
export function isPublicLabComingSoon(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
  user?: Parameters<typeof isAdminUser>[0],
): boolean {
  if (!isKubernetesChallenge(challenge)) return false;
  return !isAdminUser(user) && !isAdminUser(getCurrentUser());
}

type MainTab = 'terminal' | 'editor' | 'investigation';

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

const LAB_TIMER_LOW_MS = 5 * 60 * 1000;

function formatLabTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatProgressBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 * 1024 ? 0 : 1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${n} B`;
}

/** Countdown until the lab locks. The server reports the deadline on each heartbeat. */
function useLabTimeLeft(sessionId: string, enabled: boolean): number | null {
  const [leftMs, setLeftMs] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    deadlineRef.current = null;
    setLeftMs(null);
    if (!enabled || !sessionId) return undefined;
    const sync = (remainingMs: number): void => {
      const deadline = Date.now() + remainingMs;
      deadlineRef.current = deadline;
      setLeftMs(Math.max(0, deadline - Date.now()));
    };
    const onTime = (event: Event): void => {
      const detail = (event as CustomEvent<LabTimeLeftDetail>).detail;
      if (!detail || detail.sessionId !== sessionId || !Number.isFinite(detail.idleRemainingMs)) return;
      sync(detail.idleRemainingMs);
    };
    const tick = (): void => {
      if (deadlineRef.current == null) return;
      setLeftMs(Math.max(0, deadlineRef.current - Date.now()));
    };
    window.addEventListener(LAB_TIME_LEFT_EVENT, onTime);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.removeEventListener(LAB_TIME_LEFT_EVENT, onTime);
      window.clearInterval(timer);
    };
  }, [sessionId, enabled]);

  return leftMs;
}

const BOOT_PHASES = [
  'Creating your machine',
  'Waiting for your machine to start',
  'Preparing the lab',
  'Applying your saved progress',
];

/** Kubernetes platform labs: the steps this open actually spends time on. */
const K8S_PLATFORM_BOOT_PHASES = [
  'Creating your machine',
  'Starting the machine',
  'Loading the node image',
  'Preparing the cluster',
  'Preparing the lab',
];

/** Spark labs where Master/Worker auto-start. Pull and cache are the same moment: one is skipped. */
const SPARK_BOOT_PHASES = [
  'Creating your cluster',
  'Pulling the Spark image',
  'Using the cached Spark image',
  'Starting the master',
  'Starting the workers',
  'Preparing the lab',
];

/** Chapter 2 YARN labs: RM + NodeManagers. Pull and cache are the same moment: one is skipped. */
const YARN_BOOT_PHASES = [
  'Creating your YARN cluster',
  'Pulling the Spark-on-YARN image',
  'Using the cached Spark-on-YARN image',
  'Starting the ResourceManager',
  'Starting the NodeManagers',
  'Preparing the lab',
];

/** Spark labs where nodes are procured idle — learner brings the cluster up. */
const SPARK_MANUAL_BOOT_PHASES = [
  'Planning for a Spark cluster',
  'Procuring the nodes',
  'Installing Spark on the nodes',
  'Preparing the lab',
];

const SAVE_PHASE = BOOT_PHASES[3];
const INSTALL_PHASE = 'Installing tools from your saved progress';

type BootStepState = 'done' | 'current' | 'upcoming' | 'skipped' | 'failed';

function BootMark({ state }: { state: BootStepState }): JSX.Element {
  if (state === 'done') {
    return (
      <span className="k8s-lab-boot-mark is-done" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.2 6.15 4.7 8.55 9.8 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="k8s-lab-boot-mark is-failed" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return <span className={`k8s-lab-boot-mark is-${state}`} aria-hidden="true" />;
}

function BootLog({
  phase,
  machineLabel,
  machineCheck,
  machineCheckMessage,
  sparkDaemonMode,
  sparkYarn,
  bootHeading,
  bootPhases,
}: {
  phase: LabBootPhase;
  machineLabel: string;
  machineCheck?: 'checking' | 'failed' | null;
  machineCheckMessage?: string | null;
  sparkDaemonMode?: 'auto' | 'manual' | null;
  sparkYarn?: boolean;
  /** Per-lab override from platformSpec.boot */
  bootHeading?: string | null;
  bootPhases?: string[] | null;
}): JSX.Element {
  const platform = machineLabel === 'Kubernetes';
  const spark = machineLabel === 'Spark';
  const customPhases = Array.isArray(bootPhases) && bootPhases.length > 0 ? bootPhases : null;
  const seenManualPhase = [phase.current, ...(phase.steps || [])].some((step) => (
    step === 'Planning for a Spark cluster'
    || step === 'Procuring the nodes'
    || step === 'Installing Spark on the nodes'
  ));
  const seenYarnPhase = [phase.current, ...(phase.steps || [])].some((step) => (
    step === 'Creating your YARN cluster'
    || step === 'Pulling the Spark-on-YARN image'
    || step === 'Using the cached Spark-on-YARN image'
    || step === 'Starting the ResourceManager'
    || step === 'Starting the NodeManagers'
  ));
  const sparkManual = !customPhases && spark && (sparkDaemonMode === 'manual' || seenManualPhase);
  const yarn = !customPhases && spark && !sparkManual && (sparkYarn || seenYarnPhase);
  const phases = customPhases
    || (spark
      ? (sparkManual ? SPARK_MANUAL_BOOT_PHASES : yarn ? YARN_BOOT_PHASES : SPARK_BOOT_PHASES)
      : platform
        ? K8S_PLATFORM_BOOT_PHASES
        : BOOT_PHASES);
  const hold = machineCheck === 'checking' || machineCheck === 'failed';
  // No backend phase yet → all upcoming. Never invent "Creating your machine".
  const reported = !platform && !spark && phase.current === INSTALL_PHASE
    ? SAVE_PHASE
    : (phase.current && phases.includes(phase.current) ? phase.current : null);
  const currentAt = reported ? phases.indexOf(reported) : -1;
  const seen = new Set([...(phase.steps || []), reported].filter((step): step is string => Boolean(step)));
  const pullLabel = yarn ? 'Pulling the Spark-on-YARN image' : 'Pulling the Spark image';
  const cacheLabel = yarn ? 'Using the cached Spark-on-YARN image' : 'Using the cached Spark image';
  const pullSeen = seen.has(pullLabel);
  const cacheSeen = seen.has(cacheLabel);
  const pastImage = spark && !customPhases && !sparkManual && currentAt > phases.indexOf(cacheLabel);
  const heading = (bootHeading && bootHeading.trim())
    || (sparkManual
      ? 'Preparing your nodes'
      : yarn
        ? 'Starting your YARN cluster'
        : platform || spark
          ? 'Starting your cluster'
          : `Starting your ${machineLabel} ${machineLabel === 'Kafka' ? 'cluster' : 'machine'}`);
  return (
    <div className="k8s-lab-boot">
      <strong>{heading}</strong>
      <ol className="k8s-lab-boot-log">
        {phases.map((step, index) => {
          const skipped = !hold && !customPhases && (spark && !sparkManual
            ? (step === pullLabel && (cacheSeen || (pastImage && !pullSeen)))
              || (step === cacheLabel && pullSeen)
            : !platform && !spark && step === SAVE_PHASE && phase.restoresSave === false && reported !== SAVE_PHASE);
          const state: BootStepState = hold
            ? (index === 0 ? (machineCheck === 'failed' ? 'failed' : 'current') : 'upcoming')
            : skipped
            ? 'skipped'
            : currentAt < 0
              ? 'upcoming'
              : index === currentAt
                ? 'current'
                : index < currentAt
                  ? 'done'
                  : 'upcoming';
          return (
            <li key={step} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <BootMark state={state} />
              <span>
                {step}
                {skipped ? <em className="k8s-lab-boot-skip">Skipped</em> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {machineCheck === 'failed' && machineCheckMessage ? (
        <p className="k8s-lab-boot-fail">{machineCheckMessage}</p>
      ) : null}
    </div>
  );
}

const RESULTS_DRAWER_DEFAULT = 280;
const RESULTS_DRAWER_MIN = 140;
const RESULTS_DRAWER_MAX = 560;

export default function K8sLabWorkspace({
  challenge,
  session,
  onClose: _onClose,
}: K8sLabWorkspaceProps): JSX.Element {
  const { currentUser, onSelectChallenge, onBackToLibrary } = useAppState();
  const isAdmin = isAdminUser(currentUser) || isAdminUser(getCurrentUser());
  const showReviewTab = isReviewStaff(currentUser) || isReviewStaff(getCurrentUser());
  const labReady = session.labReady !== false;
  const lockedMessage = session.lockedMessage || null;
  const idleLocked = Boolean(session.idleLocked);
  const notStarted = Boolean(session.notStarted);
  const labComingSoon =
    isPublicLabComingSoon(challenge, currentUser)
    || (
      !isAdmin
      && Boolean(lockedMessage?.toLowerCase().includes('coming soon'))
    );
  // Public preview: never show the Start button — Coming soon replaces standby.
  const showNotStarted = notStarted && !labComingSoon;
  const terminalLocked = Boolean(lockedMessage) || idleLocked || labComingSoon;
  const challengeId = challenge?.id || '';
  const box = isBoxChallenge(challenge);
  const machineLabel = boxMachineLabel(challenge);
  const sparkLab = challenge?.sandboxType === 'spark';
  const sparkYarn = sparkLab && String(challenge?.k8sPlatform?.shape || '') === 'yarn-2';
  const sparkDaemonMode = sparkLab
    && String(challenge?.k8sPlatform?.daemonMode || '') === 'manual'
    ? 'manual' as const
    : sparkLab
      ? 'auto' as const
      : null;
  const notReadyTitle = showNotStarted
    ? (sparkLab && sparkDaemonMode === 'manual'
      ? 'Start the lab to use the terminal'
      : sparkLab
      ? 'Start the cluster to use the terminal'
      : box ? 'Start the machine to use the terminal' : 'Start the lab to use the terminal')
    : idleLocked
    ? 'This lab\'s time has run out'
    : labComingSoon
      ? 'Coming soon'
    : lockedMessage
      ? 'Lab is unavailable right now'
      : 'Lab is still preparing';
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
  const sparkNodes = SPARK_LAB_NODES[challengeId] ?? null;
  const [sparkNode, setSparkNode] = useState<string | null>(null);
  const [sparkUiAsk, setSparkUiAsk] = useState(false);
  const [termEpoch, setTermEpoch] = useState(0);
  // Editor first so the lab is usable instantly; the terminal connects in the background.
  // Box labs (Linux, Docker) have no Editor: files are edited on the machine itself.
  const [mainTab, setMainTab] = useState<MainTab>(box ? 'terminal' : 'editor');
  const investigationSpec = sparkInvestigation(challengeId);
  const investigationLab = investigationSpec != null;
  const [investigation, setInvestigation] = useState<Record<string, string>>(() => loadInvestigation(challengeId));
  const investigationLoaded = useRef('');
  useEffect(() => {
    if (!investigationLab || !challengeId) return;
    if (investigationLoaded.current !== challengeId) {
      investigationLoaded.current = challengeId;
      setInvestigation(loadInvestigation(challengeId));
      return;
    }
    saveInvestigation(challengeId, investigation);
  }, [investigationLab, challengeId, investigation]);
  const showBrief = isNarrow ? mobilePane === 'brief' : !briefCollapsed;
  const showWorkspace = isNarrow ? mobilePane === 'workspace' : true;
  const desktopOnly = isNarrow && challenge?.sandboxType !== 'linux' && challenge?.sandboxType !== 'kafka' && challenge?.sandboxType !== 'spark';
  const showResize = !isNarrow && !briefCollapsed;
  const [briefTab, setBriefTab] = useState<ProblemStatementTab>('description');
  const [briefChallenge, setBriefChallenge] = useState<ChallengePublic | ChallengeFull | null>(challenge);
  const isPractice = Boolean((briefChallenge || challenge)?.k8sPlatform?.practice);
  const hasGuideTab = Boolean(challengeGuideText(briefChallenge || challenge));
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
  const [progress, setProgress] = useState<LabProgressStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveModal, setSaveModal] = useState<GradeModalPhase | null>(null);
  const [saveDetail, setSaveDetail] = useState<string | null>(null);
  const saveModalOpen = useRef(false);
  const [bootPhase, setBootPhase] = useState<LabBootPhase>({ steps: [], current: null, restoresSave: null });
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
  const timeLeftMs = useLabTimeLeft(
    session.id,
    Boolean(labReady && !idleLocked && !notStarted && !session.id.startsWith('pending-k8s-')),
  );

  useEffect(() => {
    if ((!box && !sparkLab) || labReady || terminalLocked || notStarted) return undefined;
    let stop = false;
    setBootPhase({ steps: [], current: null, restoresSave: null });
    const tick = (): void => {
      void fetchLabBootPhase(session.bootSeq || 0, challengeId)
        .then((phase) => { if (!stop) setBootPhase(phase); })
        .catch(() => { /* keep the last step we already showed */ });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [box, sparkLab, labReady, terminalLocked, notStarted, session.id, session.bootSeq, challengeId]);

  useEffect(() => {
    if (!box || !labReady || session.id.startsWith('pending-k8s-')) return undefined;
    let stop = false;
    void fetchLabProgress(session.id)
      .then((status) => { if (!stop) setProgress(status); })
      .catch(() => { if (!stop) setProgress(null); });
    return () => { stop = true; };
  }, [box, labReady, session.id]);

  const onSaveProgress = async (): Promise<void> => {
    if (!progress?.enabled || saving) return;
    setSaving(true);
    saveModalOpen.current = true;
    setSaveDetail(null);
    setSaveModal('saving');
    const started = Date.now();
    const hold = async () => {
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    };
    try {
      const status = await saveLabProgress(session.id);
      setProgress(status);
      setSaveDetail(
        `${formatProgressBytes(status.bytes)} saved for this lab. ${formatProgressBytes(status.usedBytes)} of ${formatProgressBytes(status.limitBytes)} used across your labs.`,
      );
      await hold();
      if (saveModalOpen.current) setSaveModal('saved');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setSaveDetail(err?.response?.data?.error || err.message || 'Could not save progress');
      await hold();
      if (saveModalOpen.current) setSaveModal('save-fail');
    } finally {
      setSaving(false);
    }
  };

  // One live shell per machine. Switching nodes hides the others; it does not close them.
  const [shellNodes, setShellNodes] = useState<string[]>([]);

  useEffect(() => {
    setSparkNode(null);
    setShellNodes([]);
    setSparkUiAsk(false);
  }, [session.id, session.bootSeq, challengeId]);

  const openSparkShell = (id: string): void => {
    setSparkNode(id);
    setMainTab('terminal');
    setShellNodes((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const shellBase = useMemo(() => {
    if (!labReady || !session.id || session.id.startsWith('pending-k8s-')) return '';
    return withLabClientId(session.terminalWsUrl || k8sTerminalWsUrl(session.id));
  }, [labReady, session.terminalWsUrl, session.id]);

  const wsUrl = useMemo(() => {
    if (!shellBase) return '';
    if (sparkNodes && !sparkNode) return '';
    const node = sparkNode ? `&node=${encodeURIComponent(sparkNode)}` : '';
    return `${shellBase}${node}&v=${termEpoch}`;
  }, [shellBase, termEpoch, sparkNodes, sparkNode]);

  const nodeShellUrl = (id: string): string => (
    shellBase ? `${shellBase}&node=${encodeURIComponent(id)}&v=${termEpoch}` : ''
  );

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
    if (!challengeId) return;
    void fetchChallengeK8sSubmissions(challengeId)
      .then((rows) => {
        setSubmissions((prev) => {
          const pending = prev.filter((row) => row.pending);
          return pending.length ? [...pending, ...rows] : rows;
        });
      })
      .catch(() => {
        // Fall back to this sitting if the challenge-wide list is unavailable.
        if (!session.id || session.id.startsWith('pending-')) return;
        void fetchK8sSubmissions(session.id)
          .then((rows) => {
            setSubmissions((prev) => {
              const pending = prev.filter((row) => row.pending);
              return pending.length ? [...pending, ...rows] : rows;
            });
          })
          .catch(() => { /* keep last list */ });
      });
  };

  useEffect(() => {
    setSubmissions([]);
    setSelectedSubmissionId(null);
    if (!challengeId) return;
    refreshSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

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
      shellRef.current?.classList.remove('is-pane-resizing');
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
      const res = await gradeK8sSession(session.id, investigationLab ? investigation : undefined);
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
      const status = await fetchLabProgress(session.id).catch(() => null);
      if (status) setProgress(status);
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
              {!isNarrow && <BriefBackButton onClick={onBackToLibrary} />}
              <button
                type="button"
                role="tab"
                aria-selected={briefTab === 'description'}
                className={`spark-brief-tab${briefTab === 'description' ? ' active' : ''}`}
                onClick={() => setBriefTab('description')}
              >
                Description
              </button>
              {hasGuideTab ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={briefTab === 'guide'}
                  className={`spark-brief-tab${briefTab === 'guide' ? ' active' : ''}`}
                  onClick={() => setBriefTab('guide')}
                >
                  Guide
                </button>
              ) : null}
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
            shellRef.current?.classList.add('is-pane-resizing');
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
                {!box && !terminalLocked && !showNotStarted && (
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
                    labComingSoon
                      ? 'Coming soon'
                      : showNotStarted
                      ? (sparkLab ? 'Cluster has not been started' : box ? 'Machine has not been started' : 'Lab has not been started')
                      : terminalLocked
                      ? (idleLocked ? 'This lab\'s time has run out' : 'Terminal is unavailable right now')
                      : labReady
                        ? (box ? 'Terminal' : `Terminal (${toggleHint} to toggle)`)
                        : 'Terminal is connecting in the background'
                  }
                >
                  Terminal
                  <span
                    className={`k8s-lab-term-status${labReady && !terminalLocked && !showNotStarted ? ' is-ready' : ''}${terminalLocked || labComingSoon ? ' is-locked' : ''}${showNotStarted ? ' is-idle' : ''}`}
                    aria-label={labComingSoon ? 'coming soon' : showNotStarted ? 'not started' : terminalLocked ? 'unavailable' : labReady ? 'ready' : 'connecting'}
                  />
                </button>
                {investigationLab && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mainTab === 'investigation'}
                  className={`k8s-lab-main-tab${mainTab === 'investigation' ? ' active' : ''}`}
                  onClick={() => setMainTab('investigation')}
                  title="Record what you find before submitting"
                >
                  Investigation
                </button>
                )}
              </div>
            </div>
            <div className="spark-ide-actionbar-right">
              {timeLeftMs != null && (
                <span
                  className={`k8s-lab-timer${timeLeftMs <= LAB_TIMER_LOW_MS ? ' is-low' : ''}`}
                  role="timer"
                  aria-label={`${formatLabTimer(timeLeftMs)} left in this lab`}
                  title="Time left in this lab. The terminal closes when it runs out."
                >
                  <IconClock />
                  {formatLabTimer(timeLeftMs)}
                </span>
              )}
              {box && progress?.enabled && (
                <button
                  type="button"
                  className="spark-ide-btn spark-ide-btn--run spark-ide-btn--icon"
                  disabled={busy || saving || !labReady}
                  aria-label="Save progress"
                  onClick={() => void onSaveProgress()}
                  title={
                    !labReady
                      ? notReadyTitle
                      : `Save progress. Files, accounts, and apt packages for this lab. ${formatProgressBytes(progress.usedBytes)} of ${formatProgressBytes(progress.limitBytes)} used across all labs.`
                  }
                >
                  <IconSave />
                </button>
              )}
              <button
                type="button"
                className="spark-ide-btn spark-ide-btn--run spark-ide-btn--icon"
                disabled={busy || !labReady}
                aria-label="Reset"
                onClick={() => setResetConfirmOpen(true)}
                title={
                  !labReady
                    ? notReadyTitle
                    : box ? 'Reset. Start over on a fresh machine' : 'Reset workloads in your namespace'
                }
              >
                <IconReset />
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
                  title={!labReady ? notReadyTitle : 'Submit for grading'}
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
              {showNotStarted ? (
                <div className="k8s-lab-locked k8s-lab-standby" role="status">
                  <svg className="k8s-lab-locked-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" />
                  </svg>
                  <strong>{sparkLab ? 'Your cluster is not started' : box ? 'Your machine is not started' : 'This lab is not started'}</strong>
                  <p>
                    {sparkLab
                      ? 'The description is on the left. Start the cluster when you want the terminal.'
                      : box
                        ? 'The description is on the left. Start the machine when you want the terminal.'
                        : 'The description is on the left. Start the lab when you want the terminal.'}
                  </p>
                  {challenge && (
                    <button
                      type="button"
                      className="spark-ide-btn k8s-lab-locked-retry"
                      onClick={() => void onSelectChallenge(challenge, { start: true })}
                    >
                      {sparkLab ? 'Start cluster' : box ? 'Start machine' : 'Start lab'}
                    </button>
                  )}
                </div>
              ) : terminalLocked ? (
                <div className="k8s-lab-locked" role="status" aria-live="polite">
                  {labComingSoon ? (
                    <span className="k8s-lab-coming-soon-badge" aria-hidden="true">🔜</span>
                  ) : (
                    <svg className="k8s-lab-locked-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                      <rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  )}
                  <strong>
                    {labComingSoon
                      ? 'Coming soon'
                      : idleLocked
                        ? 'This lab\'s time is up'
                        : 'This lab is locked for now'}
                  </strong>
                  <p>
                    {labComingSoon
                      ? 'Live terminals for these labs are on the way. You can read the brief on the left.'
                      : idleLocked
                        ? (challenge?.sandboxType === 'kafka' || challenge?.sandboxType === 'spark' || challenge?.sandboxType === 'k8s-platform'
                          ? 'The time for this lab ran out, so the cluster was stopped. Start again for a fresh cluster.'
                          : box
                            ? 'The time for this lab ran out, so the machine was stopped. Start again for a fresh machine. Any progress you saved is put back.'
                            : 'The time for this lab ran out, so the lab was closed.')
                        : lockedMessage}
                  </p>
                  {!labComingSoon && (
                    <p className="k8s-lab-locked-hint">
                      You can still read the description and the rest of the brief on the left.
                    </p>
                  )}
                  {challenge && !labComingSoon && (
                    <button
                      type="button"
                      className="spark-ide-btn k8s-lab-locked-retry"
                      onClick={() => void onSelectChallenge(challenge, { start: true })}
                    >
                      {idleLocked ? 'Start again' : 'Try again'}
                    </button>
                  )}
                </div>
              ) : labReady && sparkNodes && !sparkNode ? (
                <SparkClusterDiagram
                  nodes={sparkDiagramNodes(sparkNodes)}
                  onShell={openSparkShell}
                />
              ) : !labReady ? (
                <div className={`k8s-lab-terminal-warming${box || sparkLab ? ' is-boot' : ''}`} role="status" aria-live="polite">
                  {!box && !sparkLab && <span className="spinner" />}
                  <div>
                    {box || sparkLab ? (
                      <>
                        <BootLog
                          phase={bootPhase}
                          machineLabel={machineLabel}
                          machineCheck={session.machineCheck}
                          machineCheckMessage={session.machineCheckMessage}
                          sparkDaemonMode={sparkDaemonMode}
                          sparkYarn={sparkYarn}
                          bootHeading={
                            typeof challenge?.k8sPlatform?.boot?.heading === 'string'
                              ? challenge.k8sPlatform.boot.heading
                              : null
                          }
                          bootPhases={
                            Array.isArray(challenge?.k8sPlatform?.boot?.phases)
                              ? challenge.k8sPlatform.boot.phases.map((p) => String(p || '').trim()).filter(Boolean)
                              : null
                          }
                        />
                        {session.machineCheck === 'failed' && challenge && (
                          <button
                            type="button"
                            className="spark-ide-btn k8s-lab-locked-retry"
                            onClick={() => void onSelectChallenge(challenge, { start: true })}
                          >
                            Try again
                          </button>
                        )}
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
                  {sparkNodes && sparkNode ? (
                    <>
                      <div className="spark-node-bar spark-node-bar--in-term">
                        <SparkLabKnobs
                          nodes={sparkShellNodes(sparkNodes)}
                          selected={sparkNode}
                          onPick={openSparkShell}
                        />
                        <button
                          type="button"
                          className="spark-node-ui"
                          disabled={!session.id || session.id.startsWith('pending-')}
                          onClick={() => setSparkUiAsk(true)}
                        >
                          Open the UI
                        </button>
                      </div>
                      <div className="k8s-lab-term-stack">
                        {shellNodes.map((id) => (
                          <div
                            key={id}
                            className={`k8s-lab-term-slot${sparkNode === id ? ' is-active' : ''}`}
                            aria-hidden={sparkNode !== id}
                          >
                            <TerminalPanel
                              wsUrl={nodeShellUrl(id)}
                              isActive={mainTab === 'terminal' && sparkNode === id}
                              resizeProtocol
                              onDisconnect={onTerminalDisconnect}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <TerminalPanel
                      wsUrl={wsUrl}
                      isActive={mainTab === 'terminal'}
                      resizeProtocol
                      onDisconnect={onTerminalDisconnect}
                    />
                  )}
                </>
              )}
            </div>
            {investigationLab && (
            <div
              className={`k8s-lab-investigation${mainTab === 'investigation' ? ' is-active' : ''}`}
              aria-hidden={mainTab !== 'investigation'}
            >
              {investigationSpec && (
              <SparkInvestigationForm spec={investigationSpec} value={investigation} onChange={setInvestigation} />
              )}
            </div>
            )}
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
      {sparkUiAsk && sparkNodes && session.id && !session.id.startsWith('pending-') && (
        <SparkUiChoice
          nodes={sparkNodes}
          sessionId={session.id}
          onClose={() => setSparkUiAsk(false)}
        />
      )}
      {gradeModal && (
        <SubmitReaction
          phase={gradeModal}
          detail={
            gradeModal === 'grading'
              ? (challenge?.k8sPlatform?.grade?.submitMessage || '').trim() || null
              : null
          }
          onClose={dismissGradeModal}
        />
      )}
      {saveModal && (
        <SubmitReaction
          phase={saveModal}
          detail={saveDetail}
          onClose={() => {
            saveModalOpen.current = false;
            setSaveModal(null);
          }}
        />
      )}
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
            {progress?.saved
              ? ' Everything you changed on it is lost, and saved progress for this lab is deleted.'
              : ' Everything you changed on it is lost.'}
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
