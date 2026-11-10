/**
 * Query-engine chapters 1–5, Python. Each starter repo is loaded whole from its
 * `python/files/` folder; `solution/` folders are never globbed, so they stay
 * out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see minors/query-engine/AUTHORING.md).
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { QUERY_ENGINE_VERIFY_LEAD } from './queryEngineMinor';
import { theoryForLanguage } from './theoryLanguage';

import lexerTheory from './minors/query-engine/lexer/theory.md?raw';
import parserTheory from './minors/query-engine/parser/theory.md?raw';
import catalogTheory from './minors/query-engine/catalog/theory.md?raw';
import executeTheory from './minors/query-engine/execute/theory.md?raw';
import relationalTheory from './minors/query-engine/relational/theory.md?raw';

type RawFiles = Record<string, string>;

const LEXER_FILES = import.meta.glob<string>('./minors/query-engine/lexer/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PARSER_FILES = import.meta.glob<string>('./minors/query-engine/parser/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const CATALOG_FILES = import.meta.glob<string>('./minors/query-engine/catalog/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXECUTE_FILES = import.meta.glob<string>('./minors/query-engine/execute/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const RELATIONAL_FILES = import.meta.glob<string>(
  './minors/query-engine/relational/python/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

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
      if (!(path in repoFiles)) console.error(`query-engine/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'query-engine',
    moduleId,
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: QUERY_ENGINE_VERIFY_LEAD,
  };
}

export const QUERY_ENGINE_LEXER_PYTHON = chapter(
  'lexer',
  lexerTheory,
  LEXER_FILES,
  'sqlq/lex/scan.py',
  [
    {
      id: '1.1',
      label: 'Scan an identifier',
      file: 'sqlq/lex/scan.py',
      summary: 'scan_ident: read a name, then ask the keyword table. Keywords are case-insensitive.',
    },
    {
      id: '1.2',
      label: 'Scan numbers and strings',
      file: 'sqlq/lex/scan.py',
      summary: "scan_number and scan_string: digits, and single quotes where '' is one quote.",
    },
    {
      id: '1.3',
      label: 'Scan punctuation',
      file: 'sqlq/lex/scan.py',
      summary: 'scan_symbol: one character, or an error for anything the dialect does not use.',
    },
  ],
);

export const QUERY_ENGINE_PARSER_PYTHON = chapter(
  'parser',
  parserTheory,
  PARSER_FILES,
  'sqlq/parse/expr.py',
  [
    {
      id: '2.1',
      label: 'Parse AND and comparisons',
      file: 'sqlq/parse/expr.py',
      summary: 'parse_and and parse_cmp: AND binds looser than =, <, and >.',
    },
    {
      id: '2.2',
      label: 'Parse a primary',
      file: 'sqlq/parse/expr.py',
      summary: 'parse_primary and parse_call: literals, names, table.column, COUNT, SUM, and parentheses.',
    },
    {
      id: '2.3',
      label: 'Parse SELECT',
      file: 'sqlq/parse/select.py',
      summary: 'parse_select: a target list, FROM, an optional alias, and an optional WHERE.',
    },
  ],
);

export const QUERY_ENGINE_CATALOG_PYTHON = chapter(
  'catalog',
  catalogTheory,
  CATALOG_FILES,
  'sqlq/parse/ddl.py',
  [
    {
      id: '3.1',
      label: 'Parse CREATE and INSERT',
      file: 'sqlq/parse/ddl.py',
      summary: 'parse_create and parse_insert: a column list of INT and TEXT, and rows of literals.',
    },
    {
      id: '3.2',
      label: 'Create a table',
      file: 'sqlq/catalog/mutate.py',
      summary: 'Create: a new name, unique columns, and a copy of the schema.',
    },
    {
      id: '3.3',
      label: 'Insert a row',
      file: 'sqlq/catalog/mutate.py',
      summary: 'Insert: the width and the cell types must match the table.',
    },
  ],
);

export const QUERY_ENGINE_EXECUTE_PYTHON = chapter(
  'execute',
  executeTheory,
  EXECUTE_FILES,
  'sqlq/execute/scan.py',
  [
    {
      id: '4.1',
      label: 'Scan a table',
      file: 'sqlq/execute/scan.py',
      summary: 'scan_next: one row at a time, with a copy of the column names and the values.',
    },
    {
      id: '4.2',
      label: 'Evaluate a predicate',
      file: 'sqlq/execute/eval.py',
      summary: 'Eval: literals, columns, AND, and =, <, >. AND skips the right side when the left is false.',
    },
    {
      id: '4.3',
      label: 'Filter rows',
      file: 'sqlq/execute/filter.py',
      summary: 'filter_next: pull from the child until the predicate is true.',
    },
    {
      id: '4.4',
      label: 'Project columns',
      file: 'sqlq/execute/project.py',
      summary: 'project_next: one child row in, one output row out.',
    },
  ],
);

export const QUERY_ENGINE_RELATIONAL_PYTHON = chapter(
  'relational',
  relationalTheory,
  RELATIONAL_FILES,
  'sqlq/parse/tail.py',
  [
    {
      id: '5.1',
      label: 'Parse JOIN and the tail',
      file: 'sqlq/parse/tail.py',
      summary: 'parse_join and parse_tail: INNER JOIN ON, GROUP BY, ORDER BY, and LIMIT.',
    },
    {
      id: '5.2',
      label: 'Nested-loop join',
      file: 'sqlq/execute/join.py',
      summary: 'nested_loop_next: each left row against every right row, kept when ON values match.',
    },
    {
      id: '5.3',
      label: 'COUNT and SUM',
      file: 'sqlq/execute/agg.py',
      summary: 'Aggregate: one output row per group. An empty input with no GROUP BY yields one row of zeros.',
    },
    {
      id: '5.4',
      label: 'Sort and limit',
      file: 'sqlq/execute/sort.py',
      summary: 'SortRows: order by output column names. LimitRows is already written.',
    },
  ],
);
