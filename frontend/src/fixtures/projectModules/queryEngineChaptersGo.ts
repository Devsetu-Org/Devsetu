/**
 * Query-engine chapters 1–5, Go only for now. Each starter repo is loaded whole
 * from its `go/files/` folder; `solution/` folders are never globbed, so they
 * stay out of the bundle.
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

// Vite needs the glob options written out literally in each call.
const LEXER_FILES = import.meta.glob<string>('./minors/query-engine/lexer/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PARSER_FILES = import.meta.glob<string>('./minors/query-engine/parser/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const CATALOG_FILES = import.meta.glob<string>('./minors/query-engine/catalog/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXECUTE_FILES = import.meta.glob<string>('./minors/query-engine/execute/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const RELATIONAL_FILES = import.meta.glob<string>(
  './minors/query-engine/relational/go/files/**/*',
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
      if (!(path in repoFiles)) console.error(`query-engine/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'query-engine',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: QUERY_ENGINE_VERIFY_LEAD,
  };
}

export const QUERY_ENGINE_LEXER_GO = chapter(
  'lexer',
  lexerTheory,
  LEXER_FILES,
  'internal/lex/scan.go',
  [
    {
      id: '1.1',
      label: 'Scan an identifier',
      file: 'internal/lex/scan.go',
      summary: 'scanIdent: read a name, then ask the keyword table. Keywords are case-insensitive.',
    },
    {
      id: '1.2',
      label: 'Scan numbers and strings',
      file: 'internal/lex/scan.go',
      summary: 'scanNumber and scanString: digits, and single quotes where \'\' is one quote.',
    },
    {
      id: '1.3',
      label: 'Scan punctuation',
      file: 'internal/lex/scan.go',
      summary: 'scanSymbol: one character, or an error for anything the dialect does not use.',
    },
  ],
);

export const QUERY_ENGINE_PARSER_GO = chapter(
  'parser',
  parserTheory,
  PARSER_FILES,
  'internal/parse/expr.go',
  [
    {
      id: '2.1',
      label: 'Parse AND and comparisons',
      file: 'internal/parse/expr.go',
      summary: 'parseAnd and parseCmp: AND binds looser than =, <, and >.',
    },
    {
      id: '2.2',
      label: 'Parse a primary',
      file: 'internal/parse/expr.go',
      summary: 'parsePrimary and parseCall: literals, names, table.column, COUNT, SUM, and parentheses.',
    },
    {
      id: '2.3',
      label: 'Parse SELECT',
      file: 'internal/parse/select.go',
      summary: 'parseSelect: a target list, FROM, an optional alias, and an optional WHERE.',
    },
  ],
);

export const QUERY_ENGINE_CATALOG_GO = chapter(
  'catalog',
  catalogTheory,
  CATALOG_FILES,
  'internal/parse/ddl.go',
  [
    {
      id: '3.1',
      label: 'Parse CREATE and INSERT',
      file: 'internal/parse/ddl.go',
      summary: 'parseCreate and parseInsert: a column list of INT and TEXT, and rows of literals.',
    },
    {
      id: '3.2',
      label: 'Create a table',
      file: 'internal/catalog/mutate.go',
      summary: 'Create: a new name, unique columns, and a copy of the schema.',
    },
    {
      id: '3.3',
      label: 'Insert a row',
      file: 'internal/catalog/mutate.go',
      summary: 'Insert: the width and the cell types must match the table.',
    },
  ],
);

export const QUERY_ENGINE_EXECUTE_GO = chapter(
  'execute',
  executeTheory,
  EXECUTE_FILES,
  'internal/exec/scan.go',
  [
    {
      id: '4.1',
      label: 'Scan a table',
      file: 'internal/exec/scan.go',
      summary: 'Scan.Next: one row at a time, with a copy of the column names and the values.',
    },
    {
      id: '4.2',
      label: 'Evaluate a predicate',
      file: 'internal/exec/eval.go',
      summary: 'Eval: literals, columns, AND, and =, <, >. AND skips the right side when the left is false.',
    },
    {
      id: '4.3',
      label: 'Filter rows',
      file: 'internal/exec/filter.go',
      summary: 'Filter.Next: pull from the child until the predicate is true.',
    },
    {
      id: '4.4',
      label: 'Project columns',
      file: 'internal/exec/project.go',
      summary: 'Project.Next: one child row in, one output row out.',
    },
  ],
);

export const QUERY_ENGINE_RELATIONAL_GO = chapter(
  'relational',
  relationalTheory,
  RELATIONAL_FILES,
  'internal/parse/tail.go',
  [
    {
      id: '5.1',
      label: 'Parse JOIN and the tail',
      file: 'internal/parse/tail.go',
      summary: 'parseJoin and parseTail: INNER JOIN ON, GROUP BY, ORDER BY, and LIMIT.',
    },
    {
      id: '5.2',
      label: 'Nested-loop join',
      file: 'internal/exec/join.go',
      summary: 'NestedLoop.Next: each left row against every right row, kept when ON values match.',
    },
    {
      id: '5.3',
      label: 'COUNT and SUM',
      file: 'internal/exec/agg.go',
      summary: 'Aggregate: one output row per group. An empty input with no GROUP BY yields one row of zeros.',
    },
    {
      id: '5.4',
      label: 'Sort and limit',
      file: 'internal/exec/sort.go',
      summary: 'SortRows: order by output column names. LimitRows is already written.',
    },
  ],
);
