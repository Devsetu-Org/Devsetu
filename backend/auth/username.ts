'use strict';

/**
 * Usernames are public handles. Existing accounts are filled once from the
 * email local-part. New accounts stay empty until the person chooses one.
 * After that they can change it; the name stays unique.
 */

const pool = require('../db/pool');

const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const USERNAME_RE = /^[a-z][a-z0-9_]{2,23}$/;
const RESERVED = new Set([
  'admin',
  'api',
  'devsetu',
  'null',
  'root',
  'support',
  'system',
  'undefined',
  'user',
]);

const BACKFILL_KEY = 'username_backfill_v1';

export type UsernameParse =
  | { ok: true; username: string }
  | { ok: false; error: string };

function usernameFromEmail(email: string): string {
  const local = String(email || '').split('@')[0].toLowerCase();
  let base = local.replace(/[^a-z0-9_]/g, '');
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  if (base.length < USERNAME_MIN) base = `${base}user`.slice(0, USERNAME_MIN);
  return base.slice(0, USERNAME_MAX);
}

function parseUsername(raw: unknown): UsernameParse {
  const username = String(raw || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: 'Use 3–24 characters: start with a letter, then letters, numbers, or underscores.',
    };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: 'That username is reserved.' };
  }
  return { ok: true, username };
}

function withSuffix(base: string, n: number): string {
  const suffix = String(n);
  return `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
}

async function backfillExistingUsernames(): Promise<void> {
  const { rows: meta } = await pool.query(
    `SELECT value FROM app_meta WHERE key = $1`,
    [BACKFILL_KEY],
  );
  if (String((meta[0] as { value?: string } | undefined)?.value || '') === 'done') return;

  const { rows: takenRows } = await pool.query(
    `SELECT username FROM users WHERE username IS NOT NULL`,
  );
  const taken = new Set<string>(
    (takenRows as Array<{ username: string }>).map((row) => String(row.username).toLowerCase()),
  );

  const { rows } = await pool.query(
    `SELECT id, email FROM users WHERE username IS NULL ORDER BY created_at ASC, id ASC`,
  );

  for (const row of rows as Array<{ id: string; email: string }>) {
    let base = usernameFromEmail(row.email);
    if (RESERVED.has(base)) base = withSuffix(base, 2);
    let candidate = base;
    let n = 2;
    while (taken.has(candidate) || RESERVED.has(candidate)) {
      candidate = withSuffix(base, n);
      n += 1;
    }
    taken.add(candidate);
    await pool.query(`UPDATE users SET username = $1 WHERE id = $2 AND username IS NULL`, [
      candidate,
      row.id,
    ]);
  }

  await pool.query(
    `INSERT INTO app_meta (key, value) VALUES ($1, 'done')
     ON CONFLICT (key) DO UPDATE SET value = 'done'`,
    [BACKFILL_KEY],
  );
  console.log(`[migrate] usernames backfilled for ${rows.length} existing account(s)`);
}

module.exports = {
  USERNAME_RE,
  parseUsername,
  usernameFromEmail,
  backfillExistingUsernames,
};
