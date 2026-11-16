'use strict';

/**
 * Paid subtracks lock their labs unless the user's plan covers the subtrack.
 * A lab's subtrack is its pack `category`; ids match billing plan `covers`.
 *
 * Lite + Base: 2 free labs per paid track (no credits).
 * Plus / Pro: credits unlock the rest (covers include track ids).
 * Free labs never burn credits.
 */

type LabUser = { sub?: string; userId?: string; admin?: boolean; role?: string | null; email?: string | null };

const PAID_TRACKS = new Set<string>([
  'linux',
  'docker',
  'kubernetes',
  'kafka',
  'spark',
  'k8s-platform',
]);

/** First two labs of each paid subtrack in Play order. */
const FREE_LAB_IDS = new Set<string>([
  'linux-00-first-shift-on-the-order-box',
  'linux-01-organize-the-release-folder',
  'docker-00-first-container-on-the-order-box',
  'docker-01-run-order-processor-in-a-container',
  'k8s-00-meet-kubectl',
  'l1-namespace-and-pod',
  'kafka-01-stand-up-the-cluster-and-find-everything-on-disk',
  'kafka-02-open-a-topic-the-platform-way',
  'spark-01-stand-up-the-cluster-and-find-everything-on-disk',
  'spark-02-read-the-master-ui-and-a-worker-ui-as-instruments',
]);

/** Lite-tier majors (Base+ unlocks all). */
const FREE_PROJECT_IDS = new Set<string>(['cinder']);

function paidTrackOf(challenge: { category?: string | null } | null | undefined): string | null {
  const category = String(challenge?.category || '');
  return PAID_TRACKS.has(category) ? category : null;
}

function userIdOf(user: LabUser | null | undefined): string | null {
  return user?.sub || user?.userId || null;
}

/** The JWT role can be up to 8h stale, so a reviewer claim is confirmed against the DB. */
async function isStaff(user: LabUser | null | undefined): Promise<boolean> {
  const { isAdminUser } = require('../auth/middleware');
  if (isAdminUser(user)) return true;
  const uid = userIdOf(user);
  if (user?.role !== 'reviewer' || !uid) return false;
  const { findUserById } = require('../auth/companyStore');
  const dbUser: { role?: string } | null = await findUserById(uid);
  return dbUser?.role === 'reviewer';
}

/** Feature / track ids from every entitled plan. */
async function getFeatures(user: LabUser | null | undefined): Promise<Set<string>> {
  if (await isStaff(user)) {
    return new Set([
      'projects',
      'whiteboard',
      'linux',
      'docker',
      'kubernetes',
      'kafka',
      'spark',
      'k8s-platform',
    ]);
  }
  const uid = userIdOf(user);
  if (!uid) return new Set();
  const { getEntitlements } = require('./store');
  return new Set<string>(await getEntitlements(uid));
}

/** A paid plan (or staff) is what unlocks Save progress. Lite accounts do not. */
async function hasPaidPlan(user: LabUser | null | undefined): Promise<boolean> {
  if (await isStaff(user)) return true;
  const uid = userIdOf(user);
  if (!uid) return false;
  const { listForUser, isEntitled } = require('./store');
  const subs = await listForUser(uid);
  return subs.some((s: { planId: string }) => isEntitled(s));
}

/** Subtracks the user may open past the free labs (staff get all of them). */
async function unlockedTracks(user: LabUser | null | undefined): Promise<Set<string>> {
  const features = await getFeatures(user);
  const out = new Set<string>();
  for (const t of PAID_TRACKS) {
    if (features.has(t)) out.add(t);
  }
  return out;
}

function isLabLocked(
  challenge: { id: string; category?: string | null },
  unlocked: Set<string>,
): boolean {
  const track = paidTrackOf(challenge);
  if (!track || FREE_LAB_IDS.has(challenge.id)) return false;
  return !unlocked.has(track);
}

/** Throws 402 LAB_LOCKED when the user's plan doesn't cover this lab's subtrack. */
async function assertLabUnlocked(
  user: LabUser | null | undefined,
  challenge: { id: string; category?: string | null },
): Promise<void> {
  if (!isLabLocked(challenge, await unlockedTracks(user))) return;
  const err = new Error('This lab is part of a paid track. Subscribe to unlock it.') as Error & {
    status?: number;
    code?: string;
    details?: Record<string, unknown>;
  };
  err.status = 402;
  err.code = 'LAB_LOCKED';
  err.details = { track: paidTrackOf(challenge) };
  throw err;
}

async function hasProjectsAccess(user: LabUser | null | undefined): Promise<boolean> {
  return (await getFeatures(user)).has('projects');
}

function isProjectLocked(projectId: string, hasAllProjects: boolean): boolean {
  if (hasAllProjects || FREE_PROJECT_IDS.has(projectId)) return false;
  return true;
}

async function assertProjectUnlocked(
  user: LabUser | null | undefined,
  projectId: string,
): Promise<void> {
  if (!isProjectLocked(projectId, await hasProjectsAccess(user))) return;
  const err = new Error('This project is on Base and above. Upgrade to unlock it.') as Error & {
    status?: number;
    code?: string;
  };
  err.status = 402;
  err.code = 'PROJECT_LOCKED';
  throw err;
}

async function hasWhiteboardAccess(user: LabUser | null | undefined): Promise<boolean> {
  return (await getFeatures(user)).has('whiteboard');
}

module.exports = {
  FREE_LAB_IDS,
  FREE_PROJECT_IDS,
  PAID_TRACKS,
  paidTrackOf,
  unlockedTracks,
  hasPaidPlan,
  isLabLocked,
  assertLabUnlocked,
  hasProjectsAccess,
  isProjectLocked,
  assertProjectUnlocked,
  hasWhiteboardAccess,
  getFeatures,
};
