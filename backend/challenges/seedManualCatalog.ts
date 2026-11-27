'use strict';

/**
 * Challenge catalog seed (v2).
 * Packs: backend/challenges/packs/*.json
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

interface CatalogRow {
  id: string;
  number?: number | null;
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  category: string;
  sandboxType: string;
  finalized: boolean;
  problemStatement: Record<string, unknown>;
  platformSpec: Record<string, unknown>;
  visibleTo: string | null;
  tokens: number | null;
}

const VISIBLE_TO = new Set(['admin', 'reviewers', 'users']);

function loadPackRows(): CatalogRow[] {
  const packsDir = path.join(__dirname, 'packs');
  if (!fs.existsSync(packsDir)) return [];
  return fs
    .readdirSync(packsDir)
    .filter((f: string) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f: string) => {
      const raw = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8'));
      return {
        id: raw.id,
        number: typeof raw.number === 'number' ? raw.number : null,
        title: raw.title,
        description: raw.description,
        difficulty: raw.difficulty,
        tags: raw.tags || [],
        category: raw.category,
        sandboxType: raw.sandboxType,
        finalized: raw.finalized === true,
        problemStatement: raw.problemStatement || {},
        platformSpec: raw.platformSpec || {},
        visibleTo: VISIBLE_TO.has(raw.visibleTo) ? raw.visibleTo : null,
        tokens:
          typeof raw.tokens === 'number' && Number.isFinite(raw.tokens) && raw.tokens >= 0
            ? Math.trunc(raw.tokens)
            : null,
      } as CatalogRow;
    })
    .filter((row: CatalogRow) => Boolean(row.id && row.title && row.sandboxType));
}

async function upsertChallenge(c: CatalogRow): Promise<void> {
  const now = Date.now();
  const number =
    typeof c.number === 'number' && Number.isFinite(c.number)
      ? Math.trunc(c.number)
      : null;
  // Pack `visibleTo` / `tokens` win on every boot; without them new labs start
  // admin-only with 10 tokens and existing rows keep their DB values.
  const defaultVisibleTo = c.visibleTo ?? 'admin';
  const defaultTokens = c.tokens ?? 10;
  await pool.query(
    `INSERT INTO challenges
       (id, number, title, description, difficulty, tags, category,
        finalized, sandbox_type, verified_dir,
        problem_statement, validation_spec, platform_spec,
        visible_to, tokens, bounty,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,NULL,$11,$12,$14,$14,$13,$13)
     ON CONFLICT (id) DO UPDATE SET
       number = EXCLUDED.number,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       difficulty = EXCLUDED.difficulty,
       tags = EXCLUDED.tags,
       category = EXCLUDED.category,
       finalized = EXCLUDED.finalized,
       sandbox_type = EXCLUDED.sandbox_type,
       problem_statement = EXCLUDED.problem_statement,
       platform_spec = EXCLUDED.platform_spec,
       visible_to = CASE WHEN $15::boolean THEN EXCLUDED.visible_to ELSE challenges.visible_to END,
       tokens = CASE WHEN $16::boolean THEN EXCLUDED.tokens ELSE challenges.tokens END,
       bounty = CASE WHEN $16::boolean THEN EXCLUDED.bounty ELSE challenges.bounty END,
       updated_at = EXCLUDED.updated_at`,
    [
      c.id,
      number,
      c.title,
      c.description,
      c.difficulty,
      JSON.stringify(c.tags),
      c.category,
      c.finalized,
      c.sandboxType,
      JSON.stringify(c.problemStatement),
      JSON.stringify(c.platformSpec),
      defaultVisibleTo,
      now,
      defaultTokens,
      c.visibleTo != null,
      c.tokens != null,
    ],
  );
  console.log(`[challenges] catalog upserted "${c.id}" number=${number ?? '—'}`);
}

async function seedManualCatalog(): Promise<void> {
  const keepIds = new Set(loadPackRows().map((r) => r.id));
  const byId = new Map<string, CatalogRow>();
  for (const row of loadPackRows()) byId.set(row.id, row);

  // Drop retired packs first so reused `number` values do not collide with
  // rows that are about to be replaced under a new id.
  if (keepIds.size > 0) {
    const result = await pool.query(
      `DELETE FROM challenges WHERE id <> ALL($1::text[]) RETURNING id`,
      [[...keepIds]],
    );
    for (const row of result.rows || []) {
      console.log(`[challenges] catalog removed "${row.id}"`);
    }
  }

  for (const row of byId.values()) {
    await upsertChallenge(row);
  }

  // Keep the in-memory Play cache in sync with packs (otherwise Description/Theory
  // stay stale until the next process restart).
  try {
    const loader = require('./loader');
    if (typeof loader.loadChallengesFromDB === 'function') {
      await loader.loadChallengesFromDB();
    }
  } catch (e: unknown) {
    console.warn(
      '[challenges] cache reload after seed skipped:',
      (e as Error).message,
    );
  }
}

/**
 * Watch packs/*.json and re-seed + reload cache so Description edits show up
 * without a process restart. Debounced (editors often rewrite files twice).
 * On by default (local .env often sets NODE_ENV=production). Off with DEVLABS_HOT_PACKS=0.
 */
function startPackWatcher(): void {
  const flag = String(process.env.DEVLABS_HOT_PACKS || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') return;

  const packsDir = path.join(__dirname, 'packs');
  if (!fs.existsSync(packsDir)) return;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let queued = false;

  const run = async (): Promise<void> => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      console.log('[challenges] pack change detected — reseeding catalog');
      await seedManualCatalog();
    } catch (e: unknown) {
      console.warn('[challenges] pack reseed failed:', (e as Error).message);
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void run();
      }
    }
  };

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, 400);
  };

  try {
    fs.watch(packsDir, { persistent: false }, (_event: string, filename: string | null) => {
      if (filename && !filename.endsWith('.json')) return;
      schedule();
    });
    console.log(`[challenges] watching packs for hot reload: ${packsDir}`);
  } catch (e: unknown) {
    console.warn('[challenges] pack watcher unavailable:', (e as Error).message);
  }
}

module.exports = { seedManualCatalog, loadPackRows, startPackWatcher };
