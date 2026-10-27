'use strict';

/**
 * Close a lab after a fixed time from when its machine is ready (45 minutes by default).
 * Typing, heartbeats, and other activity do not add time. Kubernetes namespace labs
 * park via endK8sSession. Linux and Docker sandboxes are ephemeral: the pod is
 * deleted and nothing is saved.
 */

import type { GameSession } from '../types/domain';

const sessionStore = require('../db/sessionStore');
const sparkLifecycle = require('./sparkLifecycle');
const boardLifecycle = require('./boardLifecycle');
const k8sLifecycle = require('./k8sLifecycle');
const lifecycle = require('../sandbox/sessionLifecycle');
const terminalEventBus = require('../observability/terminalEventBus');

const IDLE_MS = Math.max(
  60_000,
  Number(process.env.SESSION_IDLE_TIMEOUT_MS || 45 * 60 * 1000),
);
const SWEEP_MS = Math.max(
  15_000,
  Number(process.env.SESSION_IDLE_SWEEP_MS || 60_000),
);

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let ending = new Set<string>();

function openedAt(session: GameSession & { lastActivityAt?: number }): number {
  return Number(session.lastActivityAt) || Number(session.startTime) || 0;
}

async function endSessionById(sessionId: string, reason: string): Promise<void> {
  if (ending.has(sessionId)) return;
  const before = sessionStore.get(sessionId) as GameSession | null;
  if (!before || before.status !== 'active') return;

  ending.add(sessionId);
  try {
    // Remember why before teardown. The heartbeat uses this to close the terminal
    // instead of dumping the shell's disconnect logs.
    before.endReason = reason;
    let session: GameSession;
    if (before.runtime === 'spark-platform') {
      session = await sparkLifecycle.endSparkSession(sessionId);
    } else if (before.runtime === 'board') {
      session = await boardLifecycle.endBoardSession(sessionId);
    } else if (before.runtime === 'kubernetes') {
      session = await k8sLifecycle.endK8sSession(sessionId);
    } else {
      session = await lifecycle.end(sessionId);
      await sessionStore.persistRow(session);
    }
    console.log(
      `[session-idle] ended ${sessionId} runtime=${before.runtime || 'compose'} reason=${reason}`,
    );
    terminalEventBus.emit('session_end', { sessionId, reason, session });
  } catch (err: unknown) {
    console.warn(
      `[session-idle] failed to end ${sessionId}: ${(err as Error).message || err}`,
    );
  } finally {
    ending.delete(sessionId);
  }
}

async function sweepOnce(): Promise<void> {
  const now = Date.now();
  const idle: string[] = [];
  for (const session of sessionStore.all() as Array<GameSession & { lastActivityAt?: number }>) {
    if (session.status !== 'active') continue;
    if (session.runtime === 'kubernetes' && k8sLifecycle.isStartInFlight(session.id)) continue;
    const opened = openedAt(session);
    if (opened > 0 && now - opened >= IDLE_MS) {
      idle.push(session.id);
    }
  }
  for (const id of idle) {
    await endSessionById(id, 'idle_timeout');
  }
}

function startIdleWatcher(): void {
  if (sweepTimer) return;
  console.log(
    `[session-idle] watcher on (timeout=${Math.round(IDLE_MS / 1000)}s sweep=${Math.round(SWEEP_MS / 1000)}s)`,
  );
  sweepTimer = setInterval(() => {
    void sweepOnce();
  }, SWEEP_MS);
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();
}

function stopIdleWatcher(): void {
  if (!sweepTimer) return;
  clearInterval(sweepTimer);
  sweepTimer = null;
}

module.exports = {
  IDLE_MS,
  startIdleWatcher,
  stopIdleWatcher,
  sweepOnce,
  endSessionById,
};
