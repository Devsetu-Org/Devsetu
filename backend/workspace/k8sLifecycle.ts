'use strict';

import type { BoxFlavor, GameSession, K8sPlatformSpec } from '../types/domain';

const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const sessionStore = require('../db/sessionStore');
const workspaceStore = require('./workspaceStore');
const loader = require('../challenges/loader');
const k8s = require('./k8sCluster');
const capacity = require('./k8sCapacity');
const linuxBox = require('./linuxBox');
const kafkaBox = require('./kafkaBox');
const { isClusterLabType, isKafkaLabType, boxFlavor } = require('../challenges/labTypes');
const { isLinuxBlogPlayground } = require('../challenges/linuxPlayground');
const terminalEventBus = require('../observability/terminalEventBus');

interface StartK8sOpts {
  challengeId: string;
  userId?: string | null;
  candidateName?: string | null;
  /** Human-readable slug for ns-<user-name> (email local-part, display name, etc.). */
  userName?: string | null;
  /** Aborted when the learner leaves, or when a newer open replaces this one. */
  signal?: AbortSignal;
  /** Monotonic id from the browser. Cancels only apply to opens older than this. */
  openSeq?: number;
}

/**
 * A start that has not been handed to the browser yet. It is not "a lab open
 * elsewhere": leaving, or opening another lab, cancels it.
 */
const openGen = new Map<string, number>();
const inflightStarts = new Map<string, {
  controller: AbortController;
  owner: string;
  gen: number;
  /** Browser open sequence. A cancel only stops opens older than its sequence. */
  seq: number;
}>();

/** What the machine is doing while a Linux or Docker lab opens, for the terminal. */
const bootPhases = new Map<string, {
  steps: string[];
  current: string | null;
  restoresSave: boolean;
  /** Browser open sequence this phase belongs to. Older opens must not be shown. */
  openSeq: number;
}>();

function noteBootPhase(owner: string, current: string, fresh = false): void {
  if (!owner) return;
  const existing = bootPhases.get(owner);
  const prev = (!fresh && existing)
    ? existing
    : {
      steps: [] as string[],
      current: null as string | null,
      restoresSave: existing?.restoresSave || false,
      openSeq: existing?.openSeq || 0,
    };
  if (fresh) {
    prev.steps = [];
    prev.current = null;
  }
  if (prev.current === current) {
    bootPhases.set(owner, prev);
    return;
  }
  if (prev.current) prev.steps.push(prev.current);
  prev.current = current;
  bootPhases.set(owner, prev);
}

function beginBootPhase(owner: string, challengeId: string, openSeq: number): void {
  let restoresSave = false;
  if (!isLinuxBlogPlayground(challengeId)) {
    try {
      restoresSave = Boolean(linuxBox.progressStatus(owner, challengeId).saved);
    } catch {
      restoresSave = false;
    }
  }
  bootPhases.set(owner, { steps: [], current: null, restoresSave, openSeq });
  noteBootPhase(owner, 'Creating your machine');
}

function bootPhaseOf(owner: string, openSeq: number, challengeId: string | null): {
  steps: string[];
  current: string | null;
  restoresSave: boolean;
} {
  const phase = bootPhases.get(owner);
  const matched = Boolean(phase && openSeq && phase.openSeq === openSeq);
  let restoresSave = matched ? Boolean(phase?.restoresSave) : false;
  if (!matched && challengeId && !isLinuxBlogPlayground(challengeId)) {
    try {
      restoresSave = Boolean(linuxBox.progressStatus(owner, challengeId).saved);
    } catch {
      restoresSave = false;
    }
  }
  if (!matched || !phase) return { steps: [], current: null, restoresSave };
  return { steps: phase.steps, current: phase.current, restoresSave: phase.restoresSave };
}

function isStartInFlight(sessionId: string): boolean {
  return inflightStarts.has(sessionId);
}

function cancelInflightStarts(owner: string, beforeSeq?: number): void {
  const want = workspaceStore.sanitizeOwner(owner);
  for (const [id, entry] of inflightStarts) {
    if (entry.owner !== want) continue;
    if (beforeSeq != null && entry.seq >= beforeSeq) continue;
    console.log(`[k8s] cancelled in-flight open ${id}`);
    entry.controller.abort();
  }
}

export type StartK8sResult = {
  session: GameSession;
  created: boolean;
  provisioned: boolean;
};

function platformSpecOf(challengeId: string): K8sPlatformSpec {
  const c = loader.getChallenge(challengeId) as { k8sPlatform?: K8sPlatformSpec } | null;
  return c?.k8sPlatform || {};
}

/** linux / docker for box labs (one machine per learner), null for namespace labs. */
function boxFlavorOf(challengeId: string): BoxFlavor | null {
  return boxFlavor(loader.getChallenge(challengeId)?.sandboxType);
}

function isKafkaLab(challengeId: string): boolean {
  return isKafkaLabType(loader.getChallenge(challengeId)?.sandboxType);
}

/**
 * One learner namespace hosts every lab of that learner, so provision / reset /
 * park for it run strictly one at a time, whichever lab they belong to. Otherwise
 * an abandoned open's setup.sh or a closing lab's park can interleave with the
 * next lab and leak objects into (or wipe) it.
 */
const nsLocks = new Map<string, Promise<unknown>>();

function withNsLock<T>(ns: string, fn: () => Promise<T>): Promise<T> {
  const prev = nsLocks.get(ns) || Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  nsLocks.set(ns, tail);
  void tail.then(() => {
    if (nsLocks.get(ns) === tail) nsLocks.delete(ns);
  });
  return run;
}

/** ns → challenge whose park failed; its objects are still in the namespace. */
const unparked = new Map<string, string>();

async function park(ns: string, challengeId: string): Promise<void> {
  try {
    await k8s.parkChallengeNamespace(ns, challengeId);
    if (unparked.get(ns) === challengeId) unparked.delete(ns);
  } catch (err) {
    unparked.set(ns, challengeId);
    throw err;
  }
}

async function findExistingK8sSession(
  challengeId: string,
  owner: string,
): Promise<(GameSession & Record<string, unknown>) | null> {
  const mem = sessionStore
    .all()
    .find(
      (s: GameSession & Record<string, unknown>) =>
        s.runtime === 'kubernetes'
        && s.challengeId === challengeId
        && workspaceStore.sanitizeOwner(String(s.userId || '')) === owner,
    ) as (GameSession & Record<string, unknown>) | undefined;
  if (mem) return mem;

  const { rows } = await pool.query(
    `SELECT id, challenge_id, status, candidate_name, start_time, end_time, recovered,
            runtime, user_id, workspace_prefix, entrypoint, workspace_updated_at
       FROM sessions
      WHERE runtime = 'kubernetes'
        AND challenge_id = $1
        AND user_id = $2
      ORDER BY start_time ASC, id ASC
      LIMIT 1`,
    [challengeId, owner],
  );
  if (!rows[0]) return null;

  const row = rows[0];
  const session = sessionStore.makeSession({
    id: row.id,
    challengeId: row.challenge_id,
    candidateName: row.candidate_name,
    status: row.status,
  }) as GameSession & Record<string, unknown>;

  session.startTime = Number(row.start_time) || session.startTime;
  session.endTime = row.end_time ? Number(row.end_time) : null;
  session.recovered = !!row.recovered;
  session.runtime = 'kubernetes';
  session.userId = row.user_id;
  session.k8sNamespace = row.workspace_prefix;
  session.workspacePrefix = row.workspace_prefix;
  session.buildDir = null;
  session.portMap = null;
  session.services = [];
  session.terminalService = null;

  sessionStore.set(session.id, session);
  return session;
}

const LAB_ENV_UNAVAILABLE_MSG =
  'We could not prepare a clean lab environment right now. Something is down on our side. '
  + 'Please contact the administrator.';

function labEnvUnavailable(): Error {
  return Object.assign(new Error(LAB_ENV_UNAVAILABLE_MSG), {
    status: 503,
    code: 'LAB_ENV_UNAVAILABLE',
  });
}

const LAB_CAPACITY_DOWN_MSG =
  'The cluster that runs these labs is busy or offline right now, so your lab could not start. '
  + 'Please try again in a few minutes, and contact the administrator if it keeps happening.';

function labCapacityDown(): Error {
  return Object.assign(new Error(LAB_CAPACITY_DOWN_MSG), {
    status: 503,
    code: 'LAB_ENV_UNAVAILABLE',
  });
}

/** Setup failed because pods had no room (pool asleep or full), not because of a lab bug. */
const CAPACITY_FAILURE = /exceeded quota|Unschedulable|Insufficient (cpu|memory)|Too many pods/i;

/** Whether the challenge's node pool can run labs right now; the message is shown on a locked lab. */
async function labAvailability(challengeId: string): Promise<{ available: boolean; message: string | null }> {
  const flavor = boxFlavorOf(challengeId);
  const pool = isKafkaLab(challengeId) ? kafkaBox.POOL : (flavor ? linuxBox.poolFor(flavor) : undefined);
  const available = await capacity.poolUp(pool);
  return { available, message: available ? null : LAB_CAPACITY_DOWN_MSG };
}

async function requirePool(ns: string, challengeId: string, pool?: string): Promise<void> {
  if (await capacity.poolUp(pool)) return;
  console.warn(`[k8s] ${ns}: node pool ${pool || 'labs'} has no nodes and cannot add any, refusing to open ${challengeId}`);
  throw labCapacityDown();
}

function ensureProvisioned(
  ns: string,
  challengeId: string,
  forceSetup: boolean,
  signal?: AbortSignal,
  owner?: string | null,
): Promise<boolean> {
  const flavor = boxFlavorOf(challengeId);
  const kafka = isKafkaLab(challengeId);
  const onPhase = (flavor || kafka) && owner
    ? (message: string) => noteBootPhase(owner, message)
    : undefined;
  return withNsLock(ns, async () => {
    try {
      const run = (): Promise<boolean> => (
        flavor
          ? provisionBox(ns, challengeId, flavor, forceSetup, owner || null, onPhase)
          : kafka
            ? provisionKafka(ns, challengeId, onPhase)
            : provision(ns, challengeId, forceSetup)
      );
      if (!signal) return await run();
      if (signal.aborted) throw k8s.startSuperseded();
      return await k8s.runWithStartAbort(signal, run);
    } catch (err) {
      // Still inside the namespace lock, so the next open cannot see a half-built machine.
      if (!k8s.isStartSuperseded(err)) throw err;
      if (flavor) await linuxBox.deleteBox(ns).catch(() => {});
      else if (kafka) await kafkaBox.deletePod(ns).catch(() => {});
      else await k8s.wipeChallengeResources(ns, challengeId).catch(() => {});
      throw err;
    }
  });
}

/**
 * Every open boots a clean box and runs setup.sh. A paid learner's manual save
 * is applied after setup, because setup deletes lab paths and rebuilds the
 * starter state. Reset passes forceSetup and does not put the save back.
 */
async function provisionBox(
  ns: string,
  challengeId: string,
  flavor: BoxFlavor,
  forceSetup: boolean,
  owner: string | null,
  onPhase?: (message: string) => void,
): Promise<boolean> {
  onPhase?.('Creating your machine');
  const spec = platformSpecOf(challengeId);
  await requirePool(ns, challengeId, linuxBox.poolFor(flavor));
  linuxBox.discardBoxWork(ns, challengeId);
  try {
    await linuxBox.recreateBox(ns, challengeId, flavor, spec.box, onPhase);
  } catch (err) {
    if (k8s.isStartSuperseded(err)) throw err;
    console.error(`[${flavor}] ${ns}: could not start a box for ${challengeId}: ${(err as Error).message || err}`);
    throw labEnvUnavailable();
  }
  onPhase?.('Preparing the lab');
  const result = await k8s.runChallengeScript(ns, challengeId, spec.setup?.script || 'setup.sh', {
    timeoutMs: 180_000,
    env: linuxBox.scriptEnv(),
  });
  if (result.code !== 0) {
    const msg = (result.stderr || result.stdout || 'setup failed').trim();
    throw Object.assign(new Error(`Lab setup failed: ${msg}`), { status: 502 });
  }
  if (!forceSetup && owner && !isLinuxBlogPlayground(challengeId)) {
    try {
      await linuxBox.restoreProgress(ns, owner, challengeId, onPhase);
    } catch (err) {
      if (k8s.isStartSuperseded(err)) throw err;
      const message = (err as Error).message || 'could not apply saved progress';
      throw Object.assign(
        new Error(message.startsWith('Your saved') ? message : `Your saved progress could not be applied. ${message}`),
        { status: 502 },
      );
    }
  }
  return true;
}

/** Every open boots a fresh kafka-3 cluster (three broker pods and a shell), then setup.sh. No saved progress. */
async function provisionKafka(
  ns: string,
  challengeId: string,
  onPhase?: (message: string) => void,
): Promise<boolean> {
  const spec = platformSpecOf(challengeId);
  const shape = String(spec.shape || 'kafka-3');
  if (shape !== 'kafka-3') {
    throw Object.assign(new Error(`Kafka lab shape ${shape} is not available yet`), { status: 400 });
  }
  onPhase?.('Creating your machine');
  await requirePool(ns, challengeId, kafkaBox.POOL);
  try {
    await kafkaBox.recreate(ns, challengeId, onPhase);
  } catch (err) {
    if (k8s.isStartSuperseded(err)) throw err;
    console.error(`[kafka] ${ns}: could not start a cluster for ${challengeId}: ${(err as Error).message || err}`);
    throw labEnvUnavailable();
  }
  onPhase?.('Preparing the lab');
  const result = await k8s.runChallengeScript(ns, challengeId, spec.setup?.script || 'setup.sh', {
    timeoutMs: 180_000,
    env: kafkaBox.scriptEnv(ns),
  });
  if (result.code !== 0) {
    const msg = (result.stderr || result.stdout || 'setup failed').trim();
    throw Object.assign(new Error(`Lab setup failed: ${msg}`), { status: 502 });
  }
  return true;
}

/**
 * A lab only ever starts on an empty namespace. Leftovers mean an earlier park
 * or wipe failed; they are never silently deleted here (they may be unsaved
 * work), so the open is refused until the retry succeeds or an admin clears it.
 */
async function ensureCleanSlate(
  ns: string,
  challengeId: string,
  forceSetup: boolean,
  spec: ReturnType<typeof platformSpecOf>,
): Promise<void> {
  try {
    await k8s.ensureLearnerNamespace(ns, {
      quota: spec.quota || {},
      limitRange: spec.limitRange,
      reconcileLimits: true,
    });
    const pending = unparked.get(ns);
    if (pending) await park(ns, pending);
    if (forceSetup) {
      k8s.deleteChallengeSnapshot(ns, challengeId);
      await k8s.wipeChallengeResources(ns, challengeId);
    }
    const left = await k8s.listLeftoverResources(ns);
    if (left.length) {
      throw new Error(`${left.length} leftover object(s): ${left.slice(0, 10).join(', ')}`);
    }
  } catch (err) {
    console.error(
      `[k8s] ${ns} is not a clean slate, refusing to open ${challengeId}: ${(err as Error).message || err}`,
    );
    throw labEnvUnavailable();
  }
}

async function provision(
  ns: string,
  challengeId: string,
  forceSetup: boolean,
): Promise<boolean> {
  const spec = platformSpecOf(challengeId);
  await requirePool(ns, challengeId);
  await ensureCleanSlate(ns, challengeId, forceSetup, spec);
  // The session is already active, so this reserves the lab's slots before setup runs.
  if (!(await capacity.waitForReservation(ns))) throw labCapacityDown();

  if (!forceSetup) {
    // Resume: re-apply parked namespace state from last session end.
    const restored = await k8s.restoreChallengeSnapshot(ns, challengeId);
    if (restored) {
      await k8s.markChallengeSetup(ns, challengeId);
      await capacity.waitForPodsScheduled(ns);
      return true;
    }
    // Do not skip setup just because the NS annotation is set — a prior open can
    // mark setup complete while prerun workloads are missing (old script, wipe,
    // or timed-out seed). setup.sh is idempotent (kubectl apply).
  }

  const script = spec.setup?.script || 'setup.sh';
  // Postgres image pulls (C9+) often exceed the old 90s default.
  const result = await k8s.runChallengeScript(ns, challengeId, script, {
    timeoutMs: 180_000,
  });
  if (result.code !== 0) {
    const msg = (result.stderr || result.stdout || 'setup failed').trim();
    if (CAPACITY_FAILURE.test(msg)) {
      console.warn(`[k8s] ${ns}: setup for ${challengeId} hit a capacity limit: ${msg}`);
      throw labCapacityDown();
    }
    throw Object.assign(new Error(`Lab setup failed: ${msg}`), { status: 502 });
  }
  await k8s.markChallengeSetup(ns, challengeId);
  // The start response (and so the terminal) waits until setup pods have a node.
  await capacity.waitForPodsScheduled(ns);
  return true;
}

/** The learner's namespace, as startK8sSession derives it. */
function namespaceFor(userId: string | null, userName: string | null): string {
  const owner = workspaceStore.sanitizeOwner(userId || 'anonymous');
  return k8s.learnerNamespace(userName || owner);
}

function namespaceForChallenge(challengeId: string, userId: string | null, userName: string | null): string {
  const owner = workspaceStore.sanitizeOwner(userId || 'anonymous');
  const user = userName || owner;
  if (isKafkaLab(challengeId)) return kafkaBox.namespace(user);
  const flavor = boxFlavorOf(challengeId);
  if (!flavor) return namespaceFor(userId, userName);
  // Own namespace so opening a blog playground cannot snapshot or delete a lab box.
  if (isLinuxBlogPlayground(challengeId)) return linuxBox.playgroundNamespace(user);
  return linuxBox.boxNamespace(user, flavor);
}

/**
 * Boot the machine for this session. Registered as in-flight before the first
 * await, so another open can cancel it instead of treating it as a lab the
 * learner is already in.
 */
async function provisionAndCommit(
  session: GameSession,
  ns: string,
  challengeId: string,
  owner: string,
  signal: AbortSignal | undefined,
  openSeq: number,
): Promise<boolean> {
  const myGen = (openGen.get(session.id) || 0) + 1;
  openGen.set(session.id, myGen);
  session.status = 'active';
  session.endTime = null;
  session.endReason = null;

  const controller = new AbortController();
  const onExternalAbort = (): void => { controller.abort(); };
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const previous = inflightStarts.get(session.id);
  inflightStarts.set(session.id, { controller, owner, gen: myGen, seq: openSeq });
  previous?.controller.abort();
  cancelInflightStarts(owner, openSeq);

  try {
    await sessionStore.persistRow(session);
    const provisioned = await ensureProvisioned(ns, challengeId, false, controller.signal, owner);
    if (controller.signal.aborted || openGen.get(session.id) !== myGen) {
      throw k8s.startSuperseded();
    }
    // Clock starts when the shell attaches, not when setup finishes.
    session.lastActivityAt = null;
    await sessionStore.persistRow(session);
    return provisioned;
  } catch (err) {
    // A newer open owns this row now. Don't mark its session ended.
    if (openGen.get(session.id) !== myGen) {
      throw k8s.isStartSuperseded(err) ? err : k8s.startSuperseded();
    }
    session.status = 'ended';
    session.endTime = Date.now();
    if (k8s.isStartSuperseded(err)) session.endReason = 'replaced-by-new-lab';
    await sessionStore.persistRow(session).catch(() => {});
    throw err;
  } finally {
    const cur = inflightStarts.get(session.id);
    if (cur && cur.gen === myGen) inflightStarts.delete(session.id);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

async function startK8sSession({
  challengeId,
  userId = null,
  candidateName = null,
  userName = null,
  signal,
  openSeq = 0,
}: StartK8sOpts): Promise<StartK8sResult> {
  if (!challengeId) {
    throw Object.assign(new Error('challengeId is required'), { status: 400 });
  }

  const listed = loader.getChallenge(challengeId);
  if (!listed) {
    throw Object.assign(new Error('challenge not found'), { status: 404 });
  }
  if (!isClusterLabType(listed.sandboxType)) {
    throw Object.assign(new Error('not a kubernetes lab'), { status: 400 });
  }

  const owner = workspaceStore.sanitizeOwner(userId || candidateName || 'anonymous');
  if (boxFlavorOf(challengeId) || isKafkaLab(challengeId)) beginBootPhase(owner, challengeId, openSeq);
  const ns = namespaceForChallenge(challengeId, userId || candidateName, userName || candidateName);

  const existing = await findExistingK8sSession(challengeId, owner);
  // A lab the browser already has. An open that is still booting is not this:
  // that one is cancelled and replaced below.
  if (existing && existing.status === 'active' && !isStartInFlight(existing.id)) {
    await withNsLock(ns, async () => undefined);
    if (existing.status === 'active' && !isStartInFlight(existing.id)) {
      return { session: existing, created: false, provisioned: false };
    }
  }

  const created = !existing;
  const session = existing || sessionStore.makeSession({
    id: uuidv4(),
    challengeId,
    candidateName,
    status: 'active',
  });
  session.candidateName = candidateName || session.candidateName;
  session.runtime = 'kubernetes';
  session.userId = owner;
  session.k8sNamespace = ns;
  session.workspacePrefix = ns;
  session.buildDir = null;
  session.portMap = null;
  session.services = [];
  session.terminalService = null;
  sessionStore.set(session.id, session);

  const provisioned = await provisionAndCommit(session, ns, challengeId, owner, signal, openSeq);
  return { session, created, provisioned };
}

async function resetK8sSession(sessionId: string): Promise<GameSession> {
  const session = sessionStore.get(sessionId) as (GameSession & { k8sNamespace?: string }) | null;
  if (!session || session.runtime !== 'kubernetes') {
    throw Object.assign(new Error('not a kubernetes session'), { status: 409 });
  }
  const ns = session.k8sNamespace || session.workspacePrefix;
  const challengeId = session.challengeId;
  if (!ns || !challengeId) {
    throw Object.assign(new Error('session missing namespace'), { status: 409 });
  }
  if (boxFlavorOf(challengeId) && session.userId && !isLinuxBlogPlayground(challengeId)) {
    linuxBox.discardProgress(session.userId, challengeId);
  }
  await ensureProvisioned(ns, challengeId, true);
  session.status = 'active';
  session.endTime = null;
  session.endReason = null;
  // Fresh machine: the next shell attach starts a new lab clock.
  session.lastActivityAt = null;
  await sessionStore.persistRow(session);
  return session;
}

async function endK8sSession(sessionId: string): Promise<GameSession> {
  const session = sessionStore.get(sessionId) as
    | (GameSession & { k8sNamespace?: string })
    | null;
  if (!session) {
    throw Object.assign(new Error('session not found'), { status: 404 });
  }
  if (session.status === 'ended') {
    return session;
  }
  // Stop a boot that hasn't reached the browser. The namespace lock then
  // releases as soon as the current kubectl call dies, instead of after setup.
  inflightStarts.get(sessionId)?.controller.abort();
  const ns = session.k8sNamespace || session.workspacePrefix;
  const challengeId = session.challengeId;

  // Mark ended immediately so the client can leave; park/wipe runs in background.
  // Close shells before any await and before the box is deleted. Otherwise kubectl
  // exec is still alive when the pod goes away and prints "connection reset by peer"
  // into the learner's terminal.
  session.status = 'ended';
  session.endTime = Date.now();
  terminalEventBus.emit('session_end', { sessionId, reason: session.endReason || null });
  await sessionStore.persistRow(session);
  void capacity.nudge();

  const flavor = challengeId ? boxFlavorOf(challengeId) : null;
  const kafka = Boolean(challengeId && isKafkaLab(challengeId));
  if (ns && challengeId && kafka) {
    void withNsLock(ns, () => kafkaBox.deletePod(ns)).catch((err: unknown) => {
      console.warn(`[kafka] background cluster stop failed for ${ns}: ${(err as Error).message || err}`);
    });
  } else if (ns && challengeId && flavor) {
    // Ephemeral sandbox: drop any archive left from the old save path, then delete
    // the pod. A failed delete leaves the pod up; the next open replaces it.
    void withNsLock(ns, async () => {
      linuxBox.discardBoxWork(ns, challengeId);
      await linuxBox.deleteBox(ns);
    }).catch((err: unknown) => {
      console.warn(`[${flavor}] background box stop failed for ${ns}: ${(err as Error).message || err}`);
    });
  } else if (ns && challengeId) {
    void withNsLock(ns, () => park(ns, challengeId)).catch((err: unknown) => {
      console.warn(
        `[k8s] background park failed for ${ns}/${challengeId}: ${(err as Error).message || err}`,
      );
    });
  }
  return session;
}

async function saveLabProgress(
  session: GameSession & { k8sNamespace?: string },
  signal?: AbortSignal,
): Promise<ReturnType<typeof linuxBox.progressStatus>> {
  const ns = session.k8sNamespace || session.workspacePrefix;
  const challengeId = session.challengeId;
  const owner = session.userId;
  if (!ns || !challengeId || !owner) {
    throw Object.assign(new Error('session is missing its machine'), { status: 409 });
  }
  return withNsLock(ns, async () => {
    const current = sessionStore.get(session.id);
    if (!current || current.status !== 'active') {
      throw Object.assign(new Error('This lab is no longer open.'), { status: 409 });
    }
    return linuxBox.saveProgress(ns, owner, challengeId, signal);
  });
}

module.exports = {
  namespaceFor,
  labAvailability,
  startK8sSession,
  resetK8sSession,
  endK8sSession,
  saveLabProgress,
  bootPhaseOf,
  findExistingK8sSession,
  isStartInFlight,
  cancelInflightStarts,
};
