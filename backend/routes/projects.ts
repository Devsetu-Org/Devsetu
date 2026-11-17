'use strict';

import type { ExpressRequest, ExpressResponse, ExpressNextFunction } from '../types/express';

const express = require('express');
const { requireInterviewer } = require('../auth/middleware');
const { sanitizeOwner } = require('../workspace/workspaceStore');
const projectsRun = require('../workspace/projectsRun');

const router = express.Router();

function ownerId(req: ExpressRequest): string {
  const user = req.user as { sub?: string; id?: string; userId?: string } | undefined;
  return sanitizeOwner(user?.sub || user?.userId || user?.id || '');
}

function sendErr(res: ExpressResponse, err: unknown): void {
  const e = err as { status?: number; code?: string; message?: string };
  res.status(e.status || 500).json({
    error: e.message || 'internal error',
    code: e.code || undefined,
  });
}

/** POST /api/projects/run — start an ephemeral verify Job. */
router.post(
  '/run',
  requireInterviewer,
  express.json({ limit: '2mb' }),
  async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    try {
      const body = (req.body || {}) as {
        persistId?: unknown;
        files?: unknown;
        commands?: unknown;
      };
      const files = body.files && typeof body.files === 'object' && !Array.isArray(body.files)
        ? (body.files as Record<string, string>)
        : null;
      if (!files) {
        res.status(400).json({ error: 'files object is required', code: 'NO_FILES' });
        return;
      }
      const commands = Array.isArray(body.commands)
        ? body.commands.map((c) => String(c))
        : [];
      const result = projectsRun.startRun({
        userId: ownerId(req),
        persistId: String(body.persistId || ''),
        files,
        commands,
      });
      res.status(201).json(result);
    } catch (err) {
      if ((err as { status?: number }).status) sendErr(res, err);
      else next(err);
    }
  },
);

/** GET /api/projects/run/:id */
router.get(
  '/run/:id',
  requireInterviewer,
  (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    try {
      const run = projectsRun.getRun(ownerId(req), String(req.params.id || ''));
      res.json({ run });
    } catch (err) {
      if ((err as { status?: number }).status) sendErr(res, err);
      else next(err);
    }
  },
);

/** DELETE /api/projects/run/:id — cancel and tear down the pod. */
router.delete(
  '/run/:id',
  requireInterviewer,
  async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    try {
      const run = await projectsRun.cancelRun(ownerId(req), String(req.params.id || ''));
      res.json({ run });
    } catch (err) {
      if ((err as { status?: number }).status) sendErr(res, err);
      else next(err);
    }
  },
);

module.exports = router;
