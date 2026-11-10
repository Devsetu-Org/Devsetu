/**
 * Shell chapters 1–5, C++. Each starter repo is loaded whole from its
 * `cpp/files/` folder; `solution/` folders are never globbed, so they stay
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

const LEXER_FILES = import.meta.glob<string>('./minors/shell/lexer/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXEC_FILES = import.meta.glob<string>('./minors/shell/exec/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REDIRECTS_FILES = import.meta.glob<string>('./minors/shell/redirects/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PIPES_FILES = import.meta.glob<string>('./minors/shell/pipes/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const JOBS_FILES = import.meta.glob<string>('./minors/shell/jobs/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are module paths; the workspace wants repo-relative paths. */
function repo(globbed: RawFiles): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf('/cpp/files/');
    out[path.slice(at + '/cpp/files/'.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make asan', 'make run'];

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
    language: 'cpp',
    theory: theoryForLanguage(theory, 'cpp'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: SHELL_VERIFY_LEAD,
  };
}

export const SHELL_LEXER_CPP = chapter('lexer', lexerTheory, LEXER_FILES, 'src/lex/scan.cc', [
  {
    id: '1.1',
    label: 'Scan words and quotes',
    file: 'src/lex/scan.cc',
    summary: 'ScanWord: unquoted text, single quotes, and double quotes (without escapes yet).',
  },
  {
    id: '1.2',
    label: 'Scan backslash escapes',
    file: 'src/lex/scan.cc',
    summary: 'Inside ScanWord: \\ outside quotes and inside double quotes escapes the next byte.',
  },
  {
    id: '1.3',
    label: 'Scan operators',
    file: 'src/lex/scan.cc',
    summary: 'ScanOp: |, <, &, >, >>, and 2> become operator tokens.',
  },
]);

export const SHELL_EXEC_CPP = chapter('exec', execTheory, EXEC_FILES, 'src/exec/path.cc', [
  {
    id: '2.1',
    label: 'Look up a program on PATH',
    file: 'src/exec/path.cc',
    summary: 'LookPath: absolute or relative names, otherwise search PATH.',
  },
  {
    id: '2.2',
    label: 'Start and wait',
    file: 'src/exec/run.cc',
    summary: 'StartProcess and WaitProcess: fork/execve with Dir, Env, and stdio.',
  },
  {
    id: '2.3',
    label: 'Builtins cd and exit',
    file: 'src/exec/builtin.cc',
    summary: 'BuiltinCd changes s.dir; BuiltinExit records a status for the REPL.',
  },
]);

export const SHELL_REDIRECTS_CPP = chapter(
  'redirects',
  redirectsTheory,
  REDIRECTS_FILES,
  'src/parse/redir.cc',
  [
    {
      id: '3.1',
      label: 'Parse redirects',
      file: 'src/parse/redir.cc',
      summary: 'ParseRedir: operator plus a filename word into Redir.',
    },
    {
      id: '3.2',
      label: 'Open redirect files',
      file: 'src/exec/open.cc',
      summary: 'OpenOne: truncate, append, or read, resolved against the shell directory.',
    },
    {
      id: '3.3',
      label: 'Wire file descriptors',
      file: 'src/exec/apply.cc',
      summary: 'ApplyRedirsIO: attach opened files to stdin, stdout, or stderr.',
    },
  ],
);

export const SHELL_PIPES_CPP = chapter('pipes', pipesTheory, PIPES_FILES, 'src/parse/pipeline.cc', [
  {
    id: '4.1',
    label: 'Split a pipeline',
    file: 'src/parse/pipeline.cc',
    summary: 'SplitPipeline: one or more commands separated by |.',
  },
  {
    id: '4.2',
    label: 'Wire pipes',
    file: 'src/exec/pipe.cc',
    summary: 'WirePipes: pipe() between neighbours; close unused ends in the parent.',
  },
  {
    id: '4.3',
    label: 'Wait for pipeline status',
    file: 'src/exec/wait.cc',
    summary: 'WaitForeground: wait for every process; return the last status.',
  },
]);

export const SHELL_JOBS_CPP = chapter('jobs', jobsTheory, JOBS_FILES, 'src/exec/jobs.cc', [
  {
    id: '5.1',
    label: 'Background a pipeline',
    file: 'src/exec/jobs.cc',
    summary: 'AddJob: wait in a thread and publish the status when done.',
  },
  {
    id: '5.2',
    label: 'Builtin wait',
    file: 'src/exec/jobs.cc',
    summary: 'BuiltinWait: reap every recorded background job.',
  },
  {
    id: '5.3',
    label: 'Foreground interrupt hook',
    file: 'src/exec/signal.cc',
    summary: 'WithForegroundInterrupt: forward SIGINT to child processes.',
  },
]);
