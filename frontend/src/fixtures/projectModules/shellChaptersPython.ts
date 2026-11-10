/**
 * Shell chapters 1–5, Python. Each starter repo is loaded whole from its
 * `python/files/` folder; `solution/` folders are never globbed, so they stay
 * out of the bundle.
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

const LEXER_FILES = import.meta.glob<string>('./minors/shell/lexer/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXEC_FILES = import.meta.glob<string>('./minors/shell/exec/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REDIRECTS_FILES = import.meta.glob<string>('./minors/shell/redirects/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PIPES_FILES = import.meta.glob<string>('./minors/shell/pipes/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const JOBS_FILES = import.meta.glob<string>('./minors/shell/jobs/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are module paths; the workspace wants repo-relative paths. */
function repo(globbed: RawFiles): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf('/python/files/');
    out[path.slice(at + '/python/files/'.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make run'];

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
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: SHELL_VERIFY_LEAD,
  };
}

export const SHELL_LEXER_PYTHON = chapter(
  'lexer',
  lexerTheory,
  LEXER_FILES,
  'tinysh/lex/scan.py',
  [
    {
      id: '1.1',
      label: 'Scan words and quotes',
      file: 'tinysh/lex/scan.py',
      summary: 'scan_word: unquoted text, single quotes, and double quotes (without escapes yet).',
    },
    {
      id: '1.2',
      label: 'Scan backslash escapes',
      file: 'tinysh/lex/scan.py',
      summary: 'Inside scan_word: \\ outside quotes and inside double quotes escapes the next byte.',
    },
    {
      id: '1.3',
      label: 'Scan operators',
      file: 'tinysh/lex/scan.py',
      summary: 'scan_op: |, <, &, >, >>, and 2> become operator tokens.',
    },
  ],
);

export const SHELL_EXEC_PYTHON = chapter('exec', execTheory, EXEC_FILES, 'tinysh/exec/path.py', [
  {
    id: '2.1',
    label: 'Look up a program on PATH',
    file: 'tinysh/exec/path.py',
    summary: 'look_path: absolute or relative names, otherwise search PATH.',
  },
  {
    id: '2.2',
    label: 'Start and wait',
    file: 'tinysh/exec/run.py',
    summary: 'start_process and wait_process: subprocess with cwd, env, and stdio.',
  },
  {
    id: '2.3',
    label: 'Builtins cd and exit',
    file: 'tinysh/exec/builtin.py',
    summary: 'builtin_cd changes s.dir; builtin_exit records a status for the REPL.',
  },
]);

export const SHELL_REDIRECTS_PYTHON = chapter(
  'redirects',
  redirectsTheory,
  REDIRECTS_FILES,
  'tinysh/parse/redir.py',
  [
    {
      id: '3.1',
      label: 'Parse redirects',
      file: 'tinysh/parse/redir.py',
      summary: 'parse_redir: operator plus a filename word into Redir.',
    },
    {
      id: '3.2',
      label: 'Open redirect files',
      file: 'tinysh/exec/open.py',
      summary: 'open_one: truncate, append, or read, resolved against the shell directory.',
    },
    {
      id: '3.3',
      label: 'Wire file descriptors',
      file: 'tinysh/exec/apply.py',
      summary: 'apply_redirs_io: attach opened files to stdin, stdout, or stderr.',
    },
  ],
);

export const SHELL_PIPES_PYTHON = chapter(
  'pipes',
  pipesTheory,
  PIPES_FILES,
  'tinysh/parse/pipeline.py',
  [
    {
      id: '4.1',
      label: 'Split a pipeline',
      file: 'tinysh/parse/pipeline.py',
      summary: 'split_pipeline: one or more commands separated by |.',
    },
    {
      id: '4.2',
      label: 'Wire pipes',
      file: 'tinysh/exec/pipe.py',
      summary: 'wire_pipes: os.pipe between neighbours; close unused ends in the parent.',
    },
    {
      id: '4.3',
      label: 'Wait for pipeline status',
      file: 'tinysh/exec/wait.py',
      summary: 'wait_foreground: wait for every process; return the last status.',
    },
  ],
);

export const SHELL_JOBS_PYTHON = chapter('jobs', jobsTheory, JOBS_FILES, 'tinysh/exec/jobs.py', [
  {
    id: '5.1',
    label: 'Background a pipeline',
    file: 'tinysh/exec/jobs.py',
    summary: 'add_job: wait in a thread and publish the status on a done event.',
  },
  {
    id: '5.2',
    label: 'Builtin wait',
    file: 'tinysh/exec/jobs.py',
    summary: 'builtin_wait: reap every recorded background job.',
  },
  {
    id: '5.3',
    label: 'Foreground interrupt hook',
    file: 'tinysh/exec/signal.py',
    summary: 'with_foreground_interrupt: forward SIGINT to child processes.',
  },
]);
