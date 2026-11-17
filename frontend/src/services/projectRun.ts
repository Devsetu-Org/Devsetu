/**
 * Fire-and-forget project module runs.
 *
 * Uploads the browser workspace, starts an ephemeral projects-lab pod on
 * labs-projects, runs chapter verify commands, streams logs via poll, then
 * the pod is deleted.
 */

import axios from 'axios';
import { getAuthHeader } from './authApi';

export type ProjectRunStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface ProjectRunRecord {
  id: string;
  persistId: string;
  status: ProjectRunStatus;
  logs: string;
  exitCode: number | null;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
}

export interface ProjectRunRequest {
  persistId: string;
  commands: string[];
  files: Record<string, string>;
  signal?: AbortSignal;
  onLog: (line: string) => void;
  onStatus: (status: ProjectRunStatus) => void;
}

/** Poll often enough that streamed test lines feel sequential. */
const POLL_MS = 700;
const TERMINAL = new Set<ProjectRunStatus>(['succeeded', 'failed', 'cancelled']);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    const onAbort = (): void => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function mapUiStatus(status: ProjectRunStatus): ProjectRunStatus {
  if (status === 'queued') return 'starting';
  return status;
}

function apiError(err: unknown, fallback: string): Error {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; code?: string } | undefined;
    if (data?.error) return new Error(data.error);
    if (err.message) return new Error(err.message);
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}

export async function startProjectRun(body: {
  persistId: string;
  commands: string[];
  files: Record<string, string>;
}): Promise<ProjectRunRecord> {
  try {
    const { data } = await axios.post(
      '/api/projects/run',
      body,
      { headers: getAuthHeader() },
    );
    return (data as { run: ProjectRunRecord }).run;
  } catch (err) {
    throw apiError(err, 'Could not start run.');
  }
}

export async function fetchProjectRun(runId: string): Promise<ProjectRunRecord> {
  try {
    const { data } = await axios.get(`/api/projects/run/${encodeURIComponent(runId)}`, {
      headers: getAuthHeader(),
    });
    return (data as { run: ProjectRunRecord }).run;
  } catch (err) {
    throw apiError(err, 'Could not fetch run.');
  }
}

export async function cancelProjectRun(runId: string): Promise<ProjectRunRecord> {
  try {
    const { data } = await axios.delete(`/api/projects/run/${encodeURIComponent(runId)}`, {
      headers: getAuthHeader(),
    });
    return (data as { run: ProjectRunRecord }).run;
  } catch (err) {
    throw apiError(err, 'Could not cancel run.');
  }
}

/**
 * Start a real cluster run and poll until it finishes. Calls onLog with the
 * full log snapshot whenever it grows (UI replaces, not append-only).
 */
export async function runProjectModule(req: ProjectRunRequest): Promise<void> {
  const { persistId, commands, files, signal, onLog, onStatus } = req;
  onStatus('starting');
  onLog('Starting ephemeral projects-lab runner…\n');

  let run = await startProjectRun({ persistId, commands, files });
  onStatus(mapUiStatus(run.status));
  onLog(run.logs || '');

  const cancelOnAbort = (): void => {
    void cancelProjectRun(run.id).catch(() => undefined);
  };
  if (signal?.aborted) {
    cancelOnAbort();
    throw new DOMException('Aborted', 'AbortError');
  }
  signal?.addEventListener('abort', cancelOnAbort, { once: true });

  try {
    while (!TERMINAL.has(run.status)) {
      await sleep(POLL_MS, signal);
      run = await fetchProjectRun(run.id);
      onStatus(mapUiStatus(run.status));
      onLog(run.logs || '');
    }
    onStatus(run.status);
    onLog(run.logs || '');
    if (run.status === 'cancelled') {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (run.status === 'failed') {
      throw new Error(run.error || 'Run failed.');
    }
  } finally {
    signal?.removeEventListener('abort', cancelOnAbort);
  }
}
