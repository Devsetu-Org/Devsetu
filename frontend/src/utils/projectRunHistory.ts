/**
 * Chapter-scoped run history shared across languages (Go / Python).
 * Workspace files stay per-language; runs for the same chapter are one list.
 */

import type { ProjectRunStatus } from '../services/projectRun';
import type { LanguageId } from '../constants/languages';
import { LANGUAGE_LABELS } from '../constants/languages';

export interface ProjectRunHistoryEntry {
  id: string;
  language: LanguageId | null;
  status: ProjectRunStatus;
  logs: string;
  createdAt: number;
  finishedAt: number | null;
}

const MAX_ENTRIES = 30;
const MAX_LOG_CHARS = 120_000;

function storageKey(scopeId: string): string {
  return `devsetu.project-runs.${scopeId}`;
}

function truncateLogs(logs: string): string {
  if (logs.length <= MAX_LOG_CHARS) return logs;
  return `…(truncated)…\n${logs.slice(logs.length - MAX_LOG_CHARS)}`;
}

function isStatus(value: unknown): value is ProjectRunStatus {
  return (
    value === 'queued' ||
    value === 'starting' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function parseEntry(raw: unknown): ProjectRunHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return null;
  if (!isStatus(o.status)) return null;
  const language =
    o.language === 'go' || o.language === 'python' || o.language === 'cpp' ? o.language : null;
  return {
    id: o.id,
    language,
    status: o.status,
    logs: typeof o.logs === 'string' ? o.logs : '',
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
    finishedAt: typeof o.finishedAt === 'number' ? o.finishedAt : null,
  };
}

export function languageLabel(language: LanguageId | null | undefined): string | null {
  if (!language) return null;
  return LANGUAGE_LABELS[language];
}

export function loadRunHistory(scopeId: string): ProjectRunHistoryEntry[] {
  if (!scopeId || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scopeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseEntry).filter((e): e is ProjectRunHistoryEntry => e != null);
  } catch {
    return [];
  }
}

export function saveRunHistory(scopeId: string, entries: ProjectRunHistoryEntry[]): void {
  if (!scopeId || typeof window === 'undefined') return;
  try {
    const trimmed = entries.slice(0, MAX_ENTRIES).map((e) => ({
      ...e,
      logs: truncateLogs(e.logs),
    }));
    window.localStorage.setItem(storageKey(scopeId), JSON.stringify(trimmed));
  } catch {
    // Quota / private mode — history is best-effort.
  }
}

export function upsertRunHistory(
  entries: ProjectRunHistoryEntry[],
  next: ProjectRunHistoryEntry,
): ProjectRunHistoryEntry[] {
  const without = entries.filter((e) => e.id !== next.id);
  return [{ ...next, logs: truncateLogs(next.logs) }, ...without].slice(0, MAX_ENTRIES);
}

export function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
