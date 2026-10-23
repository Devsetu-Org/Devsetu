'use strict';

/**
 * Counts for the admin home.
 * `tz` is `Date#getTimezoneOffset()` minutes (UTC minus local).
 * Yesterday is the previous local calendar day. The last 7 days include today.
 */

const pool = require('../db/pool');
const { parseTzOffset } = require('../profile/activity');

const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 14;

export interface AdminOverviewDay {
  day: string;
  signups: number;
  submissions: number;
}

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
    yesterday: number;
    last7: number;
    prev7: number;
  };
  submissions: {
    total: number;
    yesterday: number;
    last7: number;
    prev7: number;
    passedYesterday: number;
    passedLast7: number;
  };
  days: AdminOverviewDay[];
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** UTC epoch of local midnight for the offset in `tzOffsetMin`. */
function startOfLocalDay(now: number, tzOffsetMin: number): number {
  const localAsUtc = now - tzOffsetMin * 60 * 1000;
  const d = new Date(localAsUtc);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() + tzOffsetMin * 60 * 1000;
}

function dayKey(ms: number, tzOffsetMin: number): string {
  const local = new Date(ms - tzOffsetMin * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayCounts(rows: Array<{ day?: string | null; n?: unknown }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.day) continue;
    map.set(String(row.day), count(row.n));
  }
  return map;
}

async function adminOverview(tzRaw: unknown): Promise<AdminOverview> {
  const tzOffsetMin = parseTzOffset(tzRaw) as number;
  const now = Date.now();
  const todayStart = startOfLocalDay(now, tzOffsetMin);
  const yesterdayStart = todayStart - DAY_MS;
  const last7Start = todayStart - 6 * DAY_MS;
  const prev7Start = last7Start - 7 * DAY_MS;
  const seriesStart = todayStart - (SERIES_DAYS - 1) * DAY_MS;
  const shift = tzOffsetMin * 60 * 1000;

  const [usersResult, submissionsResult, signupDays, submissionDays] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
         COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS yesterday,
         COUNT(*) FILTER (WHERE created_at >= $3)::int AS last7,
         COUNT(*) FILTER (WHERE created_at >= $4 AND created_at < $3)::int AS prev7
       FROM users`,
      [yesterdayStart, todayStart, last7Start, prev7Start],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE submitted_at >= $1 AND submitted_at < $2)::int AS yesterday,
         COUNT(*) FILTER (WHERE submitted_at >= $3)::int AS last7,
         COUNT(*) FILTER (WHERE submitted_at >= $4 AND submitted_at < $3)::int AS prev7,
         COUNT(*) FILTER (
           WHERE grade_status = 'passed' AND submitted_at >= $1 AND submitted_at < $2
         )::int AS passed_yesterday,
         COUNT(*) FILTER (
           WHERE grade_status = 'passed' AND submitted_at >= $3
         )::int AS passed_last7
       FROM submissions
       WHERE mode = 'submit'`,
      [yesterdayStart, todayStart, last7Start, prev7Start],
    ),
    pool.query(
      `SELECT to_char(
                to_timestamp((created_at - $2::bigint) / 1000.0) AT TIME ZONE 'UTC',
                'YYYY-MM-DD'
              ) AS day,
              COUNT(*)::int AS n
         FROM users
        WHERE created_at >= $1
        GROUP BY 1`,
      [seriesStart, shift],
    ),
    pool.query(
      `SELECT to_char(
                to_timestamp((submitted_at - $2::bigint) / 1000.0) AT TIME ZONE 'UTC',
                'YYYY-MM-DD'
              ) AS day,
              COUNT(*)::int AS n
         FROM submissions
        WHERE mode = 'submit'
          AND submitted_at >= $1
        GROUP BY 1`,
      [seriesStart, shift],
    ),
  ]);

  const users = (usersResult.rows[0] || {}) as Record<string, unknown>;
  const submissions = (submissionsResult.rows[0] || {}) as Record<string, unknown>;
  const signupsByDay = dayCounts(signupDays.rows as Array<{ day?: string | null; n?: unknown }>);
  const submissionsByDay = dayCounts(submissionDays.rows as Array<{ day?: string | null; n?: unknown }>);

  const days: AdminOverviewDay[] = [];
  for (let i = 0; i < SERIES_DAYS; i += 1) {
    const key = dayKey(seriesStart + i * DAY_MS, tzOffsetMin);
    days.push({
      day: key,
      signups: signupsByDay.get(key) || 0,
      submissions: submissionsByDay.get(key) || 0,
    });
  }

  return {
    users: {
      total: count(users.total),
      active: count(users.active),
      pending: count(users.pending),
      rejected: count(users.rejected),
      yesterday: count(users.yesterday),
      last7: count(users.last7),
      prev7: count(users.prev7),
    },
    submissions: {
      total: count(submissions.total),
      yesterday: count(submissions.yesterday),
      last7: count(submissions.last7),
      prev7: count(submissions.prev7),
      passedYesterday: count(submissions.passed_yesterday),
      passedLast7: count(submissions.passed_last7),
    },
    days,
  };
}

module.exports = { adminOverview };
