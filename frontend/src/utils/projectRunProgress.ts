/**
 * Turn streamed verify logs into a live test checklist + pass/fail counts.
 * Understands Go (`go test -v`), Python unittest `-v`, and the C++ check harness.
 */

export type CaseStatus = 'running' | 'passed' | 'failed' | 'skipped';
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface ProgressCase {
  id: string;
  name: string;
  status: CaseStatus;
}

export interface ProgressStep {
  command: string;
  status: StepStatus;
  cases: ProgressCase[];
}

export interface ProjectRunProgress {
  steps: ProgressStep[];
  /** Flat list in appearance order (for the checklist UI). */
  cases: ProgressCase[];
  passed: number;
  failed: number;
  skipped: number;
  running: number;
  total: number;
  finished: boolean;
  currentCommand: string | null;
}

const GO_RUN = /^=== RUN\s+(\S+)\s*$/;
const GO_PASS = /^--- PASS:\s+(\S+)/;
const GO_FAIL = /^--- FAIL:\s+(\S+)/;
const GO_SKIP = /^--- SKIP:\s+(\S+)/;
const PY_LINE =
  /^(test\S+)\s+\(([^)]+)\)\s+\.\.\.\s+(ok|FAIL|ERROR|skipped).*$/i;
const CPP_RUN = /^RUN\s+(\S+)\s*$/;
const CPP_PASS = /^PASS\s+(\S+)\s*$/;
const CPP_FAIL = /^FAIL\s+(\S+)\s*$/;
const GO_PKG_OK = /^ok\s+(\S+)\s+/;
const GO_PKG_FAIL = /^FAIL\s+(\S+)\s+/;
const CMD = /^\$\s+(.+)\s*$/;
const CMD_OK = /^\[ok\]\s*$/;
const CMD_EXIT = /^\[exit\s+(\d+)\]\s*$/;
const RUN_DONE = /^Run (succeeded|failed|cancelled)\.\s*$/;

/** Learner-facing label for a verify command. */
export function commandLabel(command: string): string {
  const c = command.trim();
  if (c === 'make test') return 'Unit tests';
  if (c === 'make race') return 'Race detector';
  if (c === 'make asan') return 'AddressSanitizer';
  if (c === 'make vet') return 'Vet';
  if (c === 'make bench') return 'Benchmarks';
  return c;
}

/**
 * Short label for a Go import path: prefer `internal/wal` over a bare `wal`
 * or module leaf `lsmkv` that collides with `cmd/lsmkv`.
 */
export function goPackageLabel(pkg: string): string {
  const parts = pkg.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const tail2 = parts.slice(-2).join('/');
    if (
      tail2.startsWith('internal/') ||
      tail2.startsWith('cmd/') ||
      parts.includes('internal') ||
      parts.includes('cmd')
    ) {
      return tail2;
    }
  }
  return parts[parts.length - 1] || pkg;
}

/** `cmd/...` mains are compiled by `go test ./...` but are not chapter tests. */
function isGoCmdPackage(pkg: string): boolean {
  return /(?:^|\/)cmd\//.test(pkg);
}

function recount(cases: ProgressCase[]): Pick<
  ProjectRunProgress,
  'passed' | 'failed' | 'skipped' | 'running' | 'total'
> {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;
  for (const c of cases) {
    if (c.status === 'passed') passed += 1;
    else if (c.status === 'failed') failed += 1;
    else if (c.status === 'skipped') skipped += 1;
    else if (c.status === 'running') running += 1;
  }
  return { passed, failed, skipped, running, total: cases.length };
}

/**
 * Update the open running row for `name`, or append a new row.
 * Completions without a prior RUN (Python/C++) always append.
 */
function resolveCase(
  cases: ProgressCase[],
  name: string,
  status: CaseStatus,
  stepKey: string,
): ProgressCase[] {
  if (status === 'running') {
    return [...cases, { id: `${stepKey}:${name}:${cases.length}`, name, status }];
  }
  for (let i = cases.length - 1; i >= 0; i -= 1) {
    if (cases[i].name === name && cases[i].status === 'running') {
      const next = cases.slice();
      next[i] = { ...next[i], status };
      return next;
    }
  }
  return [...cases, { id: `${stepKey}:${name}:${cases.length}`, name, status }];
}

/**
 * Parse a full log snapshot. Safe to call on every poll — pure and cheap.
 */
export function parseProjectRunProgress(logs: string): ProjectRunProgress {
  const steps: ProgressStep[] = [];
  let cases: ProgressCase[] = [];
  let finished = false;
  // Object holder so TS tracks mutations across the ensureStep closure.
  const state: { current: ProgressStep | null } = { current: null };
  let stepKey = 'boot';
  /** True after a --- PASS/FAIL/SKIP until the next package summary line. */
  let sawPerTestResult = false;

  const ensureStep = (command: string): ProgressStep => {
    if (state.current && state.current.command === command) return state.current;
    stepKey = `${steps.length}:${command}`;
    state.current = { command, status: 'running', cases: [] };
    steps.push(state.current);
    sawPerTestResult = false;
    return state.current;
  };

  const touchCase = (name: string, status: CaseStatus): void => {
    cases = resolveCase(cases, name, status, stepKey);
    if (state.current) {
      state.current.cases = resolveCase(state.current.cases, name, status, stepKey);
    } else {
      ensureStep('(tests)');
      state.current!.cases = resolveCase(state.current!.cases, name, status, stepKey);
    }
  };

  for (const raw of logs.split('\n')) {
    const line = raw.replace(/\r$/, '');

    const cmd = line.match(CMD);
    if (cmd) {
      if (state.current && state.current.status === 'running') state.current.status = 'passed';
      ensureStep(cmd[1].trim());
      continue;
    }
    if (CMD_OK.test(line)) {
      if (state.current) state.current.status = 'passed';
      continue;
    }
    const exit = line.match(CMD_EXIT);
    if (exit) {
      if (state.current) state.current.status = Number(exit[1]) === 0 ? 'passed' : 'failed';
      continue;
    }
    if (RUN_DONE.test(line)) {
      finished = true;
      if (state.current && state.current.status === 'running') {
        state.current.status = line.includes('succeeded') ? 'passed' : 'failed';
      }
      continue;
    }

    const goRun = line.match(GO_RUN);
    if (goRun) {
      touchCase(goRun[1], 'running');
      continue;
    }
    const goPass = line.match(GO_PASS);
    if (goPass) {
      sawPerTestResult = true;
      touchCase(goPass[1], 'passed');
      continue;
    }
    const goFail = line.match(GO_FAIL);
    if (goFail) {
      sawPerTestResult = true;
      touchCase(goFail[1], 'failed');
      continue;
    }
    const goSkip = line.match(GO_SKIP);
    if (goSkip) {
      sawPerTestResult = true;
      touchCase(goSkip[1], 'skipped');
      continue;
    }

    // Package ok: without -v there is no --- PASS, so each `ok pkg` is a row.
    // With -v, skip — per-test rows already cover the package.
    const pkgOk = line.match(GO_PKG_OK);
    if (pkgOk) {
      const pkg = pkgOk[1];
      const hadPerTest = sawPerTestResult;
      sawPerTestResult = false;
      if (isGoCmdPackage(pkg) || hadPerTest) continue;
      touchCase(goPackageLabel(pkg), 'passed');
      continue;
    }
    // Package FAIL: surface build failures / packages with no --- FAIL line.
    // Skip when we already listed per-test failures for this package, and skip
    // cmd/ mains that `go test ./...` compiles as cascading build noise.
    const pkgFail = line.match(GO_PKG_FAIL);
    if (pkgFail) {
      const pkg = pkgFail[1];
      const hadPerTest = sawPerTestResult;
      sawPerTestResult = false;
      if (isGoCmdPackage(pkg) || hadPerTest) continue;
      const label = goPackageLabel(pkg);
      const already = cases.some((c) => c.name === label && c.status === 'failed');
      if (!already) touchCase(label, 'failed');
      continue;
    }

    const py = line.match(PY_LINE);
    if (py) {
      const name = `${py[2]}.${py[1]}`;
      const result = py[3].toLowerCase();
      const status: CaseStatus =
        result === 'ok'
          ? 'passed'
          : result === 'skipped'
            ? 'skipped'
            : 'failed';
      touchCase(name, status);
      continue;
    }

    const cppRun = line.match(CPP_RUN);
    if (cppRun) {
      touchCase(cppRun[1], 'running');
      continue;
    }
    const cppPass = line.match(CPP_PASS);
    if (cppPass) {
      touchCase(cppPass[1], 'passed');
      continue;
    }
    const cppFail = line.match(CPP_FAIL);
    if (cppFail) {
      touchCase(cppFail[1], 'failed');
      continue;
    }
  }

  const counts = recount(cases);

  return {
    steps,
    cases,
    ...counts,
    finished,
    currentCommand:
      state.current && state.current.status === 'running' ? state.current.command : null,
  };
}
