/**
 * DS Foundations chapters — Go.
 * Fallacies labs are independent starters (no shared chapter repo) so free
 * order on the shelf cannot leak another lab's solution.
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { theoryForLanguage } from './theoryLanguage';

import lab11Theory from './minors/ds-foundations/fallacies/lab-1.1/theory.md?raw';
import lab12Theory from './minors/ds-foundations/fallacies/lab-1.2/theory.md?raw';
import lab13Theory from './minors/ds-foundations/fallacies/lab-1.3/theory.md?raw';
import lab14Theory from './minors/ds-foundations/fallacies/lab-1.4/theory.md?raw';
import partialFailureTheory from './minors/ds-foundations/partial-failure/theory.md?raw';
import timeOrderingTheory from './minors/ds-foundations/time-ordering/theory.md?raw';
import consistencyTheory from './minors/ds-foundations/consistency/theory.md?raw';
import capTheory from './minors/ds-foundations/cap/theory.md?raw';
import safetyLivenessTheory from './minors/ds-foundations/safety-liveness/theory.md?raw';

type RawFiles = Record<string, string>;

const LAB_11_FILES = import.meta.glob<string>(
  './minors/ds-foundations/fallacies/lab-1.1/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const LAB_12_FILES = import.meta.glob<string>(
  './minors/ds-foundations/fallacies/lab-1.2/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const LAB_13_FILES = import.meta.glob<string>(
  './minors/ds-foundations/fallacies/lab-1.3/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const LAB_14_FILES = import.meta.glob<string>(
  './minors/ds-foundations/fallacies/lab-1.4/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const PARTIAL_FAILURE_FILES = import.meta.glob<string>(
  './minors/ds-foundations/partial-failure/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const TIME_ORDERING_FILES = import.meta.glob<string>(
  './minors/ds-foundations/time-ordering/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const CONSISTENCY_FILES = import.meta.glob<string>(
  './minors/ds-foundations/consistency/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const CAP_FILES = import.meta.glob<string>(
  './minors/ds-foundations/cap/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);
const SAFETY_LIVENESS_FILES = import.meta.glob<string>(
  './minors/ds-foundations/safety-liveness/go/files/**/*',
  { query: '?raw', import: 'default', eager: true },
);

function repo(globbed: RawFiles, filesMarker = '/go/files/'): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf(filesMarker);
    if (at < 0) continue;
    out[path.slice(at + filesMarker.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make race'];

function chapter(
  moduleId: string,
  theory: string,
  files: RawFiles,
  entryFile: string,
  tasks: ModuleTask[],
  opts?: { verify?: string[]; verifyLead?: string },
): ProjectModuleContent {
  const repoFiles = repo(files);
  if (import.meta.env.DEV) {
    for (const path of [entryFile, ...tasks.map((t) => t.file)]) {
      if (!(path in repoFiles)) {
        console.error(`ds-foundations/${moduleId}: starter repo has no ${path}`);
      }
    }
  }
  return {
    projectId: 'ds-foundations',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: opts?.verify ?? [],
    verifyLead: opts?.verifyLead,
  };
}

const CLIENT = 'internal/client/client.go';
const COALESCE = 'internal/location/coalesce.go';
const ACCEPT = 'internal/session/accept.go';
const BUDGET = 'internal/budget/budget.go';
const LAB = 'internal/lab/lab.go';

export const DS_FOUNDATIONS_FALLACIES_1_1_GO = chapter(
  'fallacies-1.1',
  lab11Theory,
  LAB_11_FILES,
  CLIENT,
  [
    {
      id: '1.1',
      label: 'Call with bounded retries',
      file: CLIENT,
      summary:
        'Retry Network.Call up to maxAttempts when the request or reply is dropped. Exhaustion returns a clear error.',
    },
  ],
  {
    verify: VERIFY,
    verifyLead:
      'Run these from the project root. Naive* tests document the fallacy; Reliable* and OpenTrip* are what TODO(1.1) must pass.',
  },
);

export const DS_FOUNDATIONS_FALLACIES_1_2_GO = chapter(
  'fallacies-1.2',
  lab12Theory,
  LAB_12_FILES,
  COALESCE,
  [
    {
      id: '1.2',
      label: 'Coalesce location spam',
      file: COALESCE,
      summary:
        'Keep the newest pin per driver so soft location traffic does not starve trip RPCs.',
    },
  ],
  {
    verify: VERIFY,
    verifyLead: 'Run from the project root. Coalesce* tests are what TODO(1.2) must pass.',
  },
);

export const DS_FOUNDATIONS_FALLACIES_1_3_GO = chapter(
  'fallacies-1.3',
  lab13Theory,
  LAB_13_FILES,
  ACCEPT,
  [
    {
      id: '1.3',
      label: 'Reject stale mutations',
      file: ACCEPT,
      summary:
        'Accept returns false for replayed or behind-epoch strong trip mutations.',
    },
  ],
  {
    verify: VERIFY,
    verifyLead: 'Run from the project root. Accept* tests are what TODO(1.3) must pass.',
  },
);

export const DS_FOUNDATIONS_FALLACIES_1_4_GO = chapter(
  'fallacies-1.4',
  lab14Theory,
  LAB_14_FILES,
  BUDGET,
  [
    {
      id: '1.4',
      label: 'Heterogeneous attempt budgets',
      file: BUDGET,
      summary:
        'AttemptBudget returns per-class retry budgets for rider, driver, and server.',
    },
  ],
  {
    verify: VERIFY,
    verifyLead: 'Run from the project root. AttemptBudget* tests are what TODO(1.4) must pass.',
  },
);

export const DS_FOUNDATIONS_PARTIAL_FAILURE_GO = chapter(
  'partial-failure',
  partialFailureTheory,
  PARTIAL_FAILURE_FILES,
  LAB,
  [
    {
      id: '2.1',
      label: 'Silent complete with idempotency',
      file: LAB,
      summary: 'No-reply is unknown; idempotent Completed so safe retry cannot double-apply.',
    },
    {
      id: '2.2',
      label: 'Reject wrong-answer replies',
      file: LAB,
      summary: 'Bind replies to trip identity/epoch; fence stale matches.',
    },
    {
      id: '2.3',
      label: 'Cross-ack under gray failure',
      file: LAB,
      summary: 'Asymmetric views need driver ack before firm Assigned.',
    },
    {
      id: '2.4',
      label: 'Driver failure detector',
      file: LAB,
      summary: 'Lease/heartbeat suspects crashed drivers without flapping on delay.',
    },
  ],
);

export const DS_FOUNDATIONS_TIME_ORDERING_GO = chapter(
  'time-ordering',
  timeOrderingTheory,
  TIME_ORDERING_FILES,
  LAB,
  [
    {
      id: '3.1',
      label: 'Distrust skewed wall clocks',
      file: LAB,
      summary: 'Detect impossible orders under device skew; prefer logical/server time.',
    },
    {
      id: '3.2',
      label: 'Lamport on trip workflow',
      file: LAB,
      summary: 'Lamport timestamps respect happens-before on causal trip edges.',
    },
    {
      id: '3.3',
      label: 'Vector clocks for concurrency',
      file: LAB,
      summary: 'Classify concurrent cancel vs location; cancel wins.',
    },
    {
      id: '3.4',
      label: 'Order the trip event log',
      file: LAB,
      summary: 'Rebuild an audit order from a shuffled multi-node event bag.',
    },
  ],
);

export const DS_FOUNDATIONS_CONSISTENCY_GO = chapter(
  'consistency',
  consistencyTheory,
  CONSISTENCY_FILES,
  LAB,
  [
    {
      id: '4.1',
      label: 'Linearizable trip owner',
      file: LAB,
      summary: 'Match/ReadOwner histories must be linearizable.',
    },
    {
      id: '4.2',
      label: 'Weaker model for nearby',
      file: LAB,
      summary: 'Nearby-driver reads use a weaker model than ownership.',
    },
    {
      id: '4.3',
      label: 'Eventual location + sessions',
      file: LAB,
      summary: 'Locations converge; sessions give read-your-writes after reconnect.',
    },
    {
      id: '4.4',
      label: 'Pick the model per field',
      file: LAB,
      summary: 'Assign and defend a consistency model for each Fleetline field.',
    },
  ],
);

export const DS_FOUNDATIONS_CAP_GO = chapter(
  'cap',
  capTheory,
  CAP_FILES,
  LAB,
  [
    {
      id: '5.1',
      label: 'CP match under partition',
      file: LAB,
      summary: 'Fail closed on MatchDriver in a minority partition; never double-assign.',
    },
    {
      id: '5.2',
      label: 'AP map + reconcile',
      file: LAB,
      summary: 'Keep nearby/ETA available under partition; reconcile on heal.',
    },
    {
      id: '5.3',
      label: 'PACELC read paths',
      file: LAB,
      summary: 'Healthy case: favor C on owner reads, L on nearby reads.',
    },
    {
      id: '5.4',
      label: 'City-split design harness',
      file: LAB,
      summary: 'Partition → load → heal with CP match and AP map checks.',
    },
  ],
);

export const DS_FOUNDATIONS_SAFETY_LIVENESS_GO = chapter(
  'safety-liveness',
  safetyLivenessTheory,
  SAFETY_LIVENESS_FILES,
  LAB,
  [
    {
      id: '6.1',
      label: 'Check safety invariants',
      file: LAB,
      summary: 'Fail histories that double-assign or skip illegal lifecycle steps.',
    },
    {
      id: '6.2',
      label: 'Liveness under assumptions',
      file: LAB,
      summary: 'Requested trips eventually Assign when delivery is fair.',
    },
    {
      id: '6.3',
      label: 'FLP intuition toy',
      file: LAB,
      summary: 'Show async+crash blocks deterministic agreement without weakening something.',
    },
    {
      id: '6.4',
      label: 'Classify Fleetline claims',
      file: LAB,
      summary: 'Label product statements as safety, liveness, SLO, or nonsense.',
    },
  ],
);

export const DS_FOUNDATIONS_CHAPTERS_GO: ProjectModuleContent[] = [
  DS_FOUNDATIONS_FALLACIES_1_1_GO,
  DS_FOUNDATIONS_FALLACIES_1_2_GO,
  DS_FOUNDATIONS_FALLACIES_1_3_GO,
  DS_FOUNDATIONS_FALLACIES_1_4_GO,
  DS_FOUNDATIONS_PARTIAL_FAILURE_GO,
  DS_FOUNDATIONS_TIME_ORDERING_GO,
  DS_FOUNDATIONS_CONSISTENCY_GO,
  DS_FOUNDATIONS_CAP_GO,
  DS_FOUNDATIONS_SAFETY_LIVENESS_GO,
];
