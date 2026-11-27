'use strict';

/**
 * Track-completion badges. A badge is earned when every finalized, non-practice
 * lab in that track's pack category has a passed submit. Computed from
 * submissions — nothing is stored.
 */

const loader = require('../challenges/loader');
const { listSolvedChallengeIds, listFirstSolveTimes } = require('../challenges/userProgress');

type TrackBadgeDef = {
  id: string;
  /** Pack `category` that must be fully solved. */
  category: string;
  label: string;
  /** Short mark shown on the crest. */
  mark: string;
};

/** Play tracks with real packs. Ids match pack `category`. */
const TRACK_BADGES: TrackBadgeDef[] = [
  { id: 'linux', category: 'linux', label: 'Linux', mark: 'LX' },
  { id: 'docker', category: 'docker', label: 'Docker', mark: 'DK' },
  { id: 'kubernetes', category: 'kubernetes', label: 'Kubernetes', mark: 'K8' },
  { id: 'kafka', category: 'kafka', label: 'Kafka', mark: 'KF' },
  { id: 'spark', category: 'spark', label: 'Spark', mark: 'SP' },
  { id: 'git', category: 'git', label: 'Git', mark: 'Git' },
  { id: 'databases', category: 'databases', label: 'Databases', mark: 'DB' },
  {
    id: 'distributed-systems',
    category: 'distributed-systems',
    label: 'Distributed Systems',
    mark: 'DS',
  },
];

type EarnedBadge = {
  id: string;
  label: string;
  mark: string;
  /** When the last required lab was first solved (ms). */
  earnedAt: number | null;
};

function requiredLabIds(category: string): string[] {
  return (loader.listChallenges() as Array<{
    id: string;
    category?: string;
    finalized?: boolean;
    k8sPlatform?: { practice?: boolean };
  }>)
    .filter(
      (c) =>
        c.category === category &&
        c.finalized === true &&
        !c.k8sPlatform?.practice,
    )
    .map((c) => c.id);
}

/**
 * Badges the user has earned by completing every finalized lab in a track.
 * Ordered by earn time (oldest first), then catalog order.
 */
async function badgesForUser(rawUserId: string | null | undefined): Promise<EarnedBadge[]> {
  const [solved, firstSolves] = await Promise.all([
    listSolvedChallengeIds(rawUserId),
    listFirstSolveTimes(rawUserId),
  ]);
  if (solved.size === 0) return [];

  const earned: EarnedBadge[] = [];
  for (const badge of TRACK_BADGES) {
    const required = requiredLabIds(badge.category);
    if (required.length === 0) continue;
    if (!required.every((id) => solved.has(id))) continue;

    let earnedAt: number | null = null;
    for (const id of required) {
      const t = firstSolves.get(id);
      if (typeof t === 'number' && Number.isFinite(t)) {
        earnedAt = earnedAt == null ? t : Math.max(earnedAt, t);
      }
    }
    earned.push({
      id: badge.id,
      label: badge.label,
      mark: badge.mark,
      earnedAt,
    });
  }

  earned.sort((a, b) => {
    const ta = a.earnedAt ?? Number.POSITIVE_INFINITY;
    const tb = b.earnedAt ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
  return earned;
}

module.exports = {
  TRACK_BADGES,
  badgesForUser,
  requiredLabIds,
};
