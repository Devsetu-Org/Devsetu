'use strict';

import type { ExpressRequest, ExpressResponse, ExpressNextFunction } from '../types/express';

const express = require('express');
const { requireInterviewer } = require('../auth/middleware');
const { sanitizeOwner } = require('../workspace/workspaceStore');
const pool = require('../db/pool');
const { isAvatarId, parseTzOffset, activityFor } = require('../profile/activity');
const { badgesForUser } = require('../profile/badges');

const router = express.Router();

function userId(req: ExpressRequest): string {
  const user = req.user as { sub?: string; userId?: string; id?: string } | undefined;
  return user?.sub || user?.userId || user?.id || '';
}

/** GET /api/profile/me?tz=<getTimezoneOffset minutes> — avatar, activity, and track badges. */
router.get('/me', requireInterviewer, async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  try {
    const id = userId(req);
    const owner = sanitizeOwner(id);
    const tz = parseTzOffset((req.query as Record<string, unknown>).tz);
    const [{ rows }, activity, badges] = await Promise.all([
      pool.query(`SELECT avatar FROM users WHERE id = $1`, [id]),
      activityFor(owner, tz),
      badgesForUser(id),
    ]);
    res.json({
      avatar: (rows[0] as { avatar?: string | null } | undefined)?.avatar ?? null,
      activity,
      badges,
    });
  } catch (e) {
    next(e);
  }
});

/** PUT /api/profile/avatar { avatar: <preset id> | null } */
router.put('/avatar', requireInterviewer, async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  try {
    const avatar = (req.body as { avatar?: unknown } | undefined)?.avatar ?? null;
    if (avatar !== null && !isAvatarId(avatar)) return res.status(400).json({ error: 'invalid_avatar' });
    await pool.query(`UPDATE users SET avatar = $2 WHERE id = $1`, [userId(req), avatar]);
    res.json({ avatar });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
