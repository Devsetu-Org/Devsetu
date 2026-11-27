'use strict';

import type { ChallengeRow, ChallengePublic, ChallengeFull } from '../types/domain';

const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const { LINUX_BLOG_PLAYGROUND_ID, isLinuxBlogPlayground } = require('./linuxPlayground');
const { publicBoardSpec, parseBoardSpec } = require('../workspace/boardGrade');
const { isClusterLabType } = require('./labTypes');

const cache = new Map<string, ChallengeFull>();

/**
 * Pack JSON is the authoring source of truth. DB is seeded on boot; without a
 * hot overlay, Description edits sit invisible until restart. On by default
 * (local .env often sets NODE_ENV=production). Disable with DEVLABS_HOT_PACKS=0.
 */
function hotPacksEnabled(): boolean {
  const flag = String(process.env.DEVLABS_HOT_PACKS || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  return true;
}

function packFilePath(challengeId: string): string {
  return path.join(__dirname, 'packs', `${challengeId}.json`);
}

/** Merge live pack fields over a cached challenge (sync read; packs are small). */
function overlayPackFromDisk(c: ChallengeFull): ChallengeFull {
  if (!hotPacksEnabled() || !c?.id) return c;
  const file = packFilePath(c.id);
  if (!fs.existsSync(file)) return c;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') return c;
    const sandbox = raw.sandboxType || c.sandboxType;
    const platformSpec = raw.platformSpec && typeof raw.platformSpec === 'object'
      ? raw.platformSpec
      : null;
    const next: ChallengeFull = {
      ...c,
      title: typeof raw.title === 'string' ? raw.title : c.title,
      description: typeof raw.description === 'string' ? raw.description : c.description,
      difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : c.difficulty,
      tags: Array.isArray(raw.tags) ? raw.tags : c.tags,
      category: typeof raw.category === 'string' ? raw.category : c.category,
      finalized: raw.finalized === true,
      sandboxType: sandbox,
      problemStatement:
        raw.problemStatement && typeof raw.problemStatement === 'object'
          ? raw.problemStatement
          : c.problemStatement,
    };
    if (typeof raw.tokens === 'number' && Number.isFinite(raw.tokens) && raw.tokens >= 0) {
      next.tokens = Math.trunc(raw.tokens);
    }
    if (platformSpec) {
      if (sandbox === 'spark-platform') {
        next.sparkPlatform = platformSpec as ChallengeFull['sparkPlatform'];
      } else if (isClusterLabType(sandbox)) {
        next.k8sPlatform = platformSpec as ChallengeFull['k8sPlatform'];
      } else if (sandbox === 'project') {
        next.projectPlatform =
          (platformSpec as { project?: ChallengeFull['projectPlatform'] }).project
          || (platformSpec as ChallengeFull['projectPlatform']);
      } else if (sandbox === 'board') {
        next.boardSpec = parseBoardSpec(platformSpec);
      }
    }
    return next;
  } catch (e: unknown) {
    console.warn(`[challenges] hot pack overlay failed for ${c.id}: ${(e as Error).message}`);
    return c;
  }
}

function publicFields(row: ChallengeRow): ChallengePublic {
  const { parseVisibleTo } = require('./access');
  const tokensRaw = Number(row.tokens ?? row.bounty);
  return {
    id: row.id,
    number: row.number ?? null,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    tags: row.tags || [],
    category: row.category,
    finalized: !!row.finalized,
    sandboxType: row.sandbox_type || null,
    visibleTo: parseVisibleTo(row.visible_to, 'admin'),
    visibilityNotes: String(row.visibility_notes || ''),
    tokens: Number.isFinite(tokensRaw) && tokensRaw >= 0 ? Math.trunc(tokensRaw) : 10,
  };
}

function fullFields(row: ChallengeRow): ChallengeFull {
  const platformSpec = row.platform_spec || null;
  const sandbox = row.sandbox_type || null;
  const boardSpec = sandbox === 'board' ? parseBoardSpec(platformSpec) : null;
  return {
    ...publicFields(row),
    verifiedDir: row.verified_dir || null,
    problemStatement: row.problem_statement || null,
    validationSpec: row.validation_spec || null,
    sparkPlatform: sandbox === 'spark-platform'
      ? (platformSpec as ChallengeFull['sparkPlatform'])
      : null,
    k8sPlatform: isClusterLabType(sandbox)
      ? (platformSpec as ChallengeFull['k8sPlatform'])
      : null,
    projectPlatform:
      sandbox === 'project' && platformSpec && typeof platformSpec === 'object'
        ? ((platformSpec as { project?: ChallengeFull['projectPlatform'] }).project
            || (platformSpec as ChallengeFull['projectPlatform']))
        : null,
    boardSpec,
  };
}

/**
 * Disk seed from sandbox/verified — disabled during catalog v2 redesign.
 * Legacy rows live in challenges_legacy; new rows via seedManualCatalog.
 */
async function seedChallengesFromDisk(verifiedRoot: string): Promise<void> {
  console.log(
    `[challenges] disk seed skipped (catalog v2); verified root would be ${verifiedRoot}`,
  );
}

async function loadChallengesFromDB(): Promise<Map<string, ChallengeFull>> {
  const { rows } = await pool.query(`SELECT * FROM challenges`);
  cache.clear();
  for (const row of rows) {
    cache.set(row.id, fullFields(row));
  }
  console.log(`[challenges] loaded ${cache.size} challenges`);
  return cache;
}

/**
 * Blog playground is not a catalog row. Sessions and the terminal still look the
 * challenge up by id, so it has to answer here without joining listChallenges.
 */
const LINUX_BLOG_PLAYGROUND: ChallengeFull = {
  id: LINUX_BLOG_PLAYGROUND_ID,
  number: null,
  title: 'Linux playground',
  description: 'A Linux machine beside a blog, for trying commands and scripts.',
  difficulty: 'L0',
  tags: ['linux', 'playground'],
  category: 'linux',
  finalized: true,
  sandboxType: 'linux',
  visibleTo: 'users',
  visibilityNotes: '',
  tokens: 0,
  verifiedDir: null,
  problemStatement: null,
  validationSpec: null,
  sparkPlatform: null,
  k8sPlatform: {
    practice: true,
    box: { hostname: 'playground', unprivileged: true },
    setup: { script: 'setup.sh' },
  },
  projectPlatform: null,
  boardSpec: null,
};

function getChallenge(id: string): ChallengeFull | null {
  if (isLinuxBlogPlayground(id)) return LINUX_BLOG_PLAYGROUND;
  const c = cache.get(id);
  return c ? overlayPackFromDisk(c) : null;
}

function listChallenges(): ChallengeFull[] {
  return Array.from(cache.values()).map(overlayPackFromDisk);
}

function contentSourceOf(c: ChallengeFull): string | null {
  const fromPlatform = (c.sparkPlatform as { contentSource?: string } | null)?.contentSource;
  return fromPlatform || null;
}

function listPublicChallenges(): Record<string, unknown>[] {
  return listChallenges().map((c) => ({
    id: c.id,
    number: c.number ?? null,
    title: c.title,
    description: c.description,
    difficulty: c.difficulty,
    tags: c.tags,
    category: c.category,
    finalized: c.finalized,
    sandboxType: c.sandboxType,
    visibleTo: c.visibleTo || 'admin',
    visibilityNotes: c.visibilityNotes || '',
    tokens: typeof c.tokens === 'number' ? c.tokens : 10,
    contentSource: contentSourceOf(c),
    problemStatement: c.problemStatement,
    sparkPlatform: c.sparkPlatform || null,
    k8sPlatform: c.k8sPlatform || null,
    projectPlatform: c.projectPlatform || null,
    boardSpec: publicBoardSpec(c.boardSpec || null),
  }));
}

function getPublicChallenge(id: string): Record<string, unknown> | null {
  const c = getChallenge(id);
  if (!c) return null;
  return {
    id: c.id,
    number: c.number ?? null,
    title: c.title,
    description: c.description,
    difficulty: c.difficulty,
    tags: c.tags,
    category: c.category,
    finalized: c.finalized,
    sandboxType: c.sandboxType,
    visibleTo: c.visibleTo || 'admin',
    visibilityNotes: c.visibilityNotes || '',
    tokens: typeof c.tokens === 'number' ? c.tokens : 10,
    contentSource: contentSourceOf(c),
    verifiedDir: c.verifiedDir,
    problemStatement: c.problemStatement,
    validationSpec: c.validationSpec,
    sparkPlatform: c.sparkPlatform || null,
    k8sPlatform: c.k8sPlatform || null,
    projectPlatform: c.projectPlatform || null,
    boardSpec: publicBoardSpec(c.boardSpec || null),
  };
}

function putChallenge(full: ChallengeFull): void {
  cache.set(full.id, full);
}

function cacheFromRow(row: ChallengeRow): ChallengeFull {
  const full = fullFields(row);
  cache.set(full.id, full);
  return full;
}

function normalizeTokens(raw: unknown, fallback = 10): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100000, Math.trunc(n));
}

async function setVisibleTo(
  challengeId: string,
  visibleTo: 'admin' | 'users' | 'reviewers',
  visibilityNotes?: string | null,
  tokens?: number | null,
): Promise<ChallengeFull | null> {
  const { parseVisibleTo } = require('./access');
  const audience = parseVisibleTo(visibleTo, 'admin');
  const notes = visibilityNotes != null ? String(visibilityNotes) : null;
  const tokensValue = tokens != null ? normalizeTokens(tokens) : null;

  let sql: string;
  let params: unknown[];
  if (notes != null && tokensValue != null) {
    sql = `UPDATE challenges
              SET visible_to = $1,
                  visibility_notes = $2,
                  tokens = $3,
                  bounty = $3,
                  updated_at = $4
            WHERE id = $5
            RETURNING *`;
    params = [audience, notes, tokensValue, Date.now(), challengeId];
  } else if (notes != null) {
    sql = `UPDATE challenges
              SET visible_to = $1,
                  visibility_notes = $2,
                  updated_at = $3
            WHERE id = $4
            RETURNING *`;
    params = [audience, notes, Date.now(), challengeId];
  } else if (tokensValue != null) {
    sql = `UPDATE challenges
              SET visible_to = $1,
                  tokens = $2,
                  bounty = $2,
                  updated_at = $3
            WHERE id = $4
            RETURNING *`;
    params = [audience, tokensValue, Date.now(), challengeId];
  } else {
    sql = `UPDATE challenges
              SET visible_to = $1,
                  updated_at = $2
            WHERE id = $3
            RETURNING *`;
    params = [audience, Date.now(), challengeId];
  }

  const { rows } = await pool.query(sql, params);
  if (!rows[0]) return null;
  return cacheFromRow(rows[0]);
}

module.exports = {
  seedChallengesFromDisk,
  loadChallengesFromDB,
  getChallenge,
  listChallenges,
  listPublicChallenges,
  getPublicChallenge,
  putChallenge,
  cacheFromRow,
  setVisibleTo,
};
