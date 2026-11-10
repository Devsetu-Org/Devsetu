/**
 * Shell chapters 1–5, Go. Each starter repo is loaded whole
 * from its `go/files/` folder; `solution/` folders are never globbed, so they
 * stay out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see minors/shell/AUTHORING.md).
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { SHELL_VERIFY_LEAD } from './shellMinor';
import { theoryForLanguage } from './theoryLanguage';

import lexerTheory from './minors/shell/lexer/theory.md?raw';
import execTheory from './minors/shell/exec/theory.md?raw';
import redirectsTheory from './minors/shell/redirects/theory.md?raw';
import pipesTheory from './minors/shell/pipes/theory.md?raw';
import jobsTheory from './minors/shell/jobs/theory.md?raw';

type RawFiles = Record<string, string>;

// Vite needs the glob options written out literally in each call.
const LEXER_FILES = import.meta.glob<string>('./minors/shell/lexer/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXEC_FILES = import.meta.glob<string>('./minors/shell/exec/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REDIRECTS_FILES = import.meta.glob<string>('./minors/shell/redirects/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PIPES_FILES = import.meta.glob<string>('./minors/shell/pipes/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const JOBS_FILES = import.meta.glob<string>('./minors/shell/jobs/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are module paths; the workspace wants repo-relative paths. */
function repo(globbed: RawFiles): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf('/go/files/');
    out[path.slice(at + '/go/files/'.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make race', 'make run'];

function chapter(
  moduleId: string,
  theory: string,
  files: RawFiles,
  entryFile: string,
  tasks: ModuleTask[],
): ProjectModuleContent {
  const repoFiles = repo(files);
  if (import.meta.env.DEV) {
    for (const path of [entryFile, ...tasks.map((t) => t.file)]) {
      if (!(path in repoFiles)) console.error(`shell/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'shell',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: SHELL_VERIFY_LEAD,
  };
}

export const SHELL_LEXER_GO = chapter('lexer', lexerTheory, LEXER_FILES, 'internal/lex/scan.go', [
  {
    id: '1.1',
    label: 'Scan words and quotes',
    file: 'internal/lex/scan.go',
    summary: 'scanWord: unquoted text, single quotes, and double quotes (without escapes yet).',
  },
  {
    id: '1.2',
    label: 'Scan backslash escapes',
    file: 'internal/lex/scan.go',
    summary: 'Inside scanWord: \\ outside quotes and inside double quotes escapes the next byte.',
  },
  {
    id: '1.3',
    label: 'Scan operators',
    file: 'internal/lex/scan.go',
    summary: 'scanOp: |, <, &, >, >>, and 2> become operator tokens.',
  },
]);

export const SHELL_EXEC_GO = chapter('exec', execTheory, EXEC_FILES, 'internal/exec/path.go', [
  {
    id: '2.1',
    label: 'Look up a program on PATH',
    file: 'internal/exec/path.go',
    summary: 'LookPath: absolute or relative names, otherwise search PATH.',
  },
  {
    id: '2.2',
    label: 'Start and wait',
    file: 'internal/exec/run.go',
    summary: 'startProcess and waitProcess: os/exec with Dir, Env, and stdio.',
  },
  {
    id: '2.3',
    label: 'Builtins cd and exit',
    file: 'internal/exec/builtin.go',
    summary: 'builtinCd changes s.Dir; builtinExit records a status for the REPL.',
  },
]);

export const SHELL_REDIRECTS_GO = chapter(
  'redirects',
  redirectsTheory,
  REDIRECTS_FILES,
  'internal/parse/redir.go',
  [
    {
      id: '3.1',
      label: 'Parse redirects',
      file: 'internal/parse/redir.go',
      summary: 'parseRedir: operator plus a filename word into ast.Redir.',
    },
    {
      id: '3.2',
      label: 'Open redirect files',
      file: 'internal/exec/open.go',
      summary: 'openOne: truncate, append, or read, resolved against the shell directory.',
    },
    {
      id: '3.3',
      label: 'Wire file descriptors',
      file: 'internal/exec/apply.go',
      summary: 'applyRedirsIO: attach opened files to stdin, stdout, or stderr.',
    },
  ],
);

export const SHELL_PIPES_GO = chapter('pipes', pipesTheory, PIPES_FILES, 'internal/parse/pipeline.go', [
  {
    id: '4.1',
    label: 'Split a pipeline',
    file: 'internal/parse/pipeline.go',
    summary: 'splitPipeline: one or more commands separated by |.',
  },
  {
    id: '4.2',
    label: 'Wire pipes',
    file: 'internal/exec/pipe.go',
    summary: 'wirePipes: os.Pipe between neighbours; close unused ends in the parent.',
  },
  {
    id: '4.3',
    label: 'Wait for pipeline status',
    file: 'internal/exec/wait.go',
    summary: 'waitForeground: wait for every process; return the last status.',
  },
]);

export const SHELL_JOBS_GO = chapter('jobs', jobsTheory, JOBS_FILES, 'internal/exec/jobs.go', [
  {
    id: '5.1',
    label: 'Background a pipeline',
    file: 'internal/exec/jobs.go',
    summary: 'addJob: wait in a goroutine and publish the status on a done channel.',
  },
  {
    id: '5.2',
    label: 'Builtin wait',
    file: 'internal/exec/jobs.go',
    summary: 'builtinWait: reap every recorded background job.',
  },
  {
    id: '5.3',
    label: 'Foreground interrupt hook',
    file: 'internal/exec/signal.go',
    summary: 'withForegroundInterrupt: forward SIGINT to child processes.',
  },
]);
