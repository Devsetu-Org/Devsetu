/**
 * Query-engine chapters 1–5, C++. Each starter repo is loaded whole from its
 * `cpp/files/` folder; `solution/` folders are never globbed, so they stay
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

const LEXER_FILES = import.meta.glob<string>('./minors/query-engine/lexer/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PARSER_FILES = import.meta.glob<string>('./minors/query-engine/parser/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const CATALOG_FILES = import.meta.glob<string>('./minors/query-engine/catalog/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXECUTE_FILES = import.meta.glob<string>('./minors/query-engine/execute/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const RELATIONAL_FILES = import.meta.glob<string>(
  './minors/query-engine/relational/cpp/files/**/*',
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
      if (!(path in repoFiles)) console.error(`query-engine/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'query-engine',
    moduleId,
    language: 'cpp',
    theory: theoryForLanguage(theory, 'cpp'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: QUERY_ENGINE_VERIFY_LEAD,
  };
}

export const QUERY_ENGINE_LEXER_CPP = chapter(
  'lexer',
  lexerTheory,
  LEXER_FILES,
  'src/lex/scan.cc',
  [
    {
      id: '1.1',
      label: 'Scan an identifier',
      file: 'src/lex/scan.cc',
      summary: 'ScanIdent: read a name, then ask the keyword table. Keywords are case-insensitive.',
    },
    {
      id: '1.2',
      label: 'Scan numbers and strings',
      file: 'src/lex/scan.cc',
      summary: "ScanNumber and ScanString: digits, and single quotes where '' is one quote.",
    },
    {
      id: '1.3',
      label: 'Scan punctuation',
      file: 'src/lex/scan.cc',
      summary: 'ScanSymbol: one character, or an error for anything the dialect does not use.',
    },
  ],
);

export const QUERY_ENGINE_PARSER_CPP = chapter(
  'parser',
  parserTheory,
  PARSER_FILES,
  'src/parse/expr.cc',
  [
    {
      id: '2.1',
      label: 'Parse AND and comparisons',
      file: 'src/parse/expr.cc',
      summary: 'ParseAnd and ParseCmp: AND binds looser than =, <, and >.',
    },
    {
      id: '2.2',
      label: 'Parse a primary',
      file: 'src/parse/expr.cc',
      summary: 'ParsePrimary and ParseCall: literals, names, table.column, COUNT, SUM, and parentheses.',
    },
    {
      id: '2.3',
      label: 'Parse SELECT',
      file: 'src/parse/select.cc',
      summary: 'ParseSelect: a target list, FROM, an optional alias, and an optional WHERE.',
    },
  ],
);

export const QUERY_ENGINE_CATALOG_CPP = chapter(
  'catalog',
  catalogTheory,
  CATALOG_FILES,
  'src/parse/ddl.cc',
  [
    {
      id: '3.1',
      label: 'Parse CREATE and INSERT',
      file: 'src/parse/ddl.cc',
      summary: 'ParseCreate and ParseInsert: a column list of INT and TEXT, and rows of literals.',
    },
    {
      id: '3.2',
      label: 'Create a table',
      file: 'src/catalog/mutate.cc',
      summary: 'Create: a new name, unique columns, and a copy of the schema.',
    },
    {
      id: '3.3',
      label: 'Insert a row',
      file: 'src/catalog/mutate.cc',
      summary: 'Insert: the width and the cell types must match the table.',
    },
  ],
);

export const QUERY_ENGINE_EXECUTE_CPP = chapter(
  'execute',
  executeTheory,
  EXECUTE_FILES,
  'src/execute/scan.cc',
  [
    {
      id: '4.1',
      label: 'Scan a table',
      file: 'src/execute/scan.cc',
      summary: 'Scan::Next: one row at a time, with a copy of the column names and the values.',
    },
    {
      id: '4.2',
      label: 'Evaluate a predicate',
      file: 'src/execute/eval.cc',
      summary: 'Eval: literals, columns, AND, and =, <, >. AND skips the right side when the left is false.',
    },
    {
      id: '4.3',
      label: 'Filter rows',
      file: 'src/execute/filter.cc',
      summary: 'Filter::Next: pull from the child until the predicate is true.',
    },
    {
      id: '4.4',
      label: 'Project columns',
      file: 'src/execute/project.cc',
      summary: 'Project::Next: one child row in, one output row out.',
    },
  ],
);

export const QUERY_ENGINE_RELATIONAL_CPP = chapter(
  'relational',
  relationalTheory,
  RELATIONAL_FILES,
  'src/parse/tail.cc',
  [
    {
      id: '5.1',
      label: 'Parse JOIN and the tail',
      file: 'src/parse/tail.cc',
      summary: 'ParseJoin and ParseTail: INNER JOIN ON, GROUP BY, ORDER BY, and LIMIT.',
    },
    {
      id: '5.2',
      label: 'Nested-loop join',
      file: 'src/execute/join.cc',
      summary: 'NestedLoop::Next: each left row against every right row, kept when ON values match.',
    },
    {
      id: '5.3',
      label: 'COUNT and SUM',
      file: 'src/execute/agg.cc',
      summary: 'Aggregate: one output row per group. An empty input with no GROUP BY yields one row of zeros.',
    },
    {
      id: '5.4',
      label: 'Sort and limit',
      file: 'src/execute/sort.cc',
      summary: 'SortRows: order by output column names. LimitRows is already written.',
    },
  ],
);
