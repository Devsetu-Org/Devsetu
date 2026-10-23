import type { ChapterReading } from './types';

/** Query engine minor, chapter 00: how SQL becomes rows, and the plan. */
export const QUERY_ENGINE_OVERVIEW: ChapterReading = {
  eyebrow: 'Query engine · Chapter 00',
  title: 'Query engines: from a SELECT string to rows',
  lede:
    'Start here before writing any code. We look at **what a SQL engine actually does**, the pipeline from text to rows, where that pipeline runs in real databases, and exactly what you will build across the five chapters of this minor.',
  showBlogStamp: true,
  sections: [
    {
      id: 'what-it-is',
      title: 'What a query engine is',
      body: [
        'A database has more than a place to store bytes. Someone types `SELECT name FROM users WHERE id = 1` and expects rows back. The piece that understands that sentence is the **query engine**.',
        'Storage engines (the LSM tree and B-tree minors) answer put, get, delete, and scan. A query engine sits above that. It turns a language into those operations, then stitches the results into the table the user asked for.',
      ],
      subsections: [
        {
          id: 'the-sentence',
          title: 'SQL is a sentence with a fixed shape',
          body: [
            'A query names **what** to return (columns, or aggregates), **where** the rows come from (tables, sometimes joined), and **which** rows qualify (a filter). `ORDER BY` and `LIMIT` arrange and cut the result. The engine does not guess. It follows a grammar.',
          ],
        },
        {
          id: 'not-the-disk',
          title: 'This minor stays above the disk',
          body: [
            'Tables live in memory. There is no pager, no WAL, and no index. Every query scans the rows it was given. That keeps the work on the language and the execution pipeline. A later engine can swap the scan for a B-tree or an LSM without changing the SQL the user types.',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'Four stages, always',
        body: [
          'Text becomes **tokens**, tokens become a **tree**, the tree is checked against the **catalog**, and an **executor** walks that tree and produces rows. Postgres, MySQL, SQLite, and DuckDB all do this. The size of the grammar and the cleverness of the plan change. The stages do not.',
        ],
      },
    },
    {
      id: 'pipeline',
      title: 'The pipeline',
      body: [
        'Take one statement and follow it through.',
      ],
      code: {
        language: 'sql',
        filename: 'users.sql',
        code: "SELECT name FROM users WHERE id = 1;",
      },
      flows: [
        {
          title: 'Front end',
          steps: ['Characters', 'Lexer → tokens', 'Parser → AST', 'Catalog check'],
        },
        {
          title: 'Back end',
          steps: ['Scan users', 'Filter id = 1', 'Project name', 'Rows out'],
        },
      ],
      after: [
        '**Lexer.** `SELECT`, `name`, `FROM`, `users`, `WHERE`, `id`, `=`, `1` are tokens. Whitespace disappears. A string or a number is one token, not a pile of characters.',
        '**Parser.** The tokens become a tree: a select node, a list of output columns, a table, and a comparison expression. The parser rejects `SELECT FROM` because the grammar says a column list comes first.',
        '**Catalog.** `users` must exist, and `id` and `name` must be columns of it. `id = 1` only makes sense if `id` is a number. This is where a typo becomes an error instead of a wrong answer.',
        '**Executor.** A scan yields every row. A filter keeps rows where the expression is true. A projection keeps only `name`. Nothing here searches an index. It walks the table.',
      ],
    },
    {
      id: 'relational',
      title: 'Joins and aggregates',
      body: [
        'A single-table filter is the core. Real queries add three more operators. Each one is a box in the pipeline that consumes rows and emits rows.',
      ],
      table: {
        headers: ['Operator', 'What it does', 'How this minor builds it'],
        rows: [
          ['**Scan**', 'Yield every row of one table', 'Walk the in-memory table in insert order'],
          ['**Filter**', 'Drop rows that fail WHERE', 'Evaluate `=`, `<`, `>`, and `AND`'],
          ['**Project**', 'Keep or compute output columns', 'Pick named columns from the row'],
          ['**Join**', 'Pair rows from two tables', 'Nested loop: for each left row, scan the right table'],
          ['**Aggregate**', 'Collapse groups into one row', '`COUNT` and `SUM`, with `GROUP BY`'],
          ['**Sort / limit**', 'Order the result and cut it', 'Sort the output, then stop after N rows'],
        ],
      },
      after: [
        'A nested-loop join is the honest algorithm: it is slow on big tables and obviously correct. Hash joins and merge joins come later, once this one is boring. The same is true of a cost-based optimizer. This minor runs the operators in the order the SQL was written.',
      ],
      callout: {
        kind: 'tip',
        title: 'Rows in, rows out',
        body: [
          'Every operator has the same shape: pull a row from the child, maybe change it, maybe skip it, then hand it up. `LIMIT` stops early. `GROUP BY` must see every input row before it emits. That pull model is how SQLite and Postgres iterators work, scaled down.',
        ],
      },
    },
    {
      id: 'where-it-runs',
      title: 'Where this pipeline runs',
      body: [
        'The dialect you will implement is tiny. The shape is the one these systems grew from.',
      ],
      table: {
        headers: ['System', 'What it is', 'How the pipeline shows up'],
        rows: [
          ['**SQLite**', 'Embedded SQL database', 'A hand-written lexer and parser, a bytecode VM that runs the plan.'],
          ['**PostgreSQL**', 'Relational database', 'Parser → rewriter → planner → executor. The executor is a tree of nodes.'],
          ['**MySQL**', 'Relational database', 'The same stages, with a different parser and optimizer per storage engine.'],
          ['**DuckDB**', 'Analytical SQL engine', 'A vectorized executor: operators chew batches of rows, not one row at a time.'],
          ['**Spark SQL**', 'Distributed SQL', 'Parser and analyzer in the driver, then a plan shipped to executors.'],
        ],
      },
      after: [
        'When a query is slow, the interesting question is which operator did the work: a scan that read too much, a join that nested two big tables, or a sort of a result that did not need to be sorted. You will have written each of those operators.',
      ],
    },
    {
      id: 'dialect',
      title: 'The dialect you will speak',
      body: [
        'Enough SQL to be recognisable, and little enough to finish. Types are `INT` and `TEXT`. There are no nulls, no subqueries, and no `UPDATE` or `DELETE` in v1.',
      ],
      code: {
        language: 'sql',
        filename: 'dialect.sql',
        code: [
          'CREATE TABLE users (id INT, name TEXT);',
          'INSERT INTO users VALUES (1, \'ada\');',
          '',
          'SELECT name FROM users WHERE id = 1;',
          '',
          'SELECT u.name, COUNT(*)',
          'FROM users u',
          'JOIN orders o ON u.id = o.user_id',
          'WHERE o.total > 10',
          'GROUP BY u.name',
          'ORDER BY COUNT(*) DESC',
          'LIMIT 5;',
        ].join('\n'),
      },
      bullets: [
        '**CREATE TABLE** and **INSERT** build the data the queries read.',
        '**SELECT** lists columns or `COUNT(*)` / `SUM(col)`.',
        '**WHERE** is comparisons combined with `AND`.',
        '**JOIN** is an inner join with one `ON` equality.',
        '**GROUP BY**, **ORDER BY**, and **LIMIT** are optional tails on the statement.',
      ],
    },
    {
      id: 'what-you-build',
      title: 'What you will build in this minor',
      body: [
        'Over five chapters you build **sqlq**, a SQL engine in Go. You type statements into a small REPL. Tests feed SQL and check the rows that come back.',
      ],
      table: {
        headers: ['Chapter', 'You build', 'Done when'],
        rows: [
          [
            '**01 · Lexer**',
            'A scanner that emits tokens and rejects junk characters',
            'Keywords, identifiers, numbers, strings, and operators round-trip, and whitespace is gone',
          ],
          [
            '**02 · Parser**',
            'A recursive-descent parser for SELECT, plus expressions',
            'A statement becomes an AST, and a broken statement fails with a clear error',
          ],
          [
            '**03 · Catalog**',
            'CREATE TABLE and INSERT into typed in-memory tables',
            'A bad column count or a bad type is rejected; a good insert is readable back',
          ],
          [
            '**04 · Execute**',
            'Scan, WHERE, and projection',
            '`SELECT name FROM users WHERE id = 1` returns the right rows and nothing else',
          ],
          [
            '**05 · Joins and aggregates**',
            'Inner join, COUNT, SUM, GROUP BY, ORDER BY, LIMIT',
            'A join-and-group query matches a hand-computed result',
          ],
          [
            '**06 · Benchmark** (coming soon)',
            'Your engine against the reference on the same SQL and data',
            'Answers match, then you see how the time compares',
          ],
        ],
      },
    },
    {
      id: 'how-chapters-work',
      title: 'How each chapter works',
      body: [],
      bullets: [
        '**Theory on the left, code on the right.** Each chapter opens with a short read, then sends you into the repository with clearly marked `TODO` blocks.',
        '**Small tasks.** A chapter has a few tasks, and each turns green as you finish it.',
        '**Tests decide.** When `make test` passes, the chapter is complete. Early chapters check tokens and trees. From the catalog on, tests are SQL in and rows or errors out.',
        '**Your code carries forward.** Each chapter starts from your own earlier work, with an opt-in reference solution if you get stuck.',
      ],
      after: [
        '**What you need:** comfortable Go (slices, structs, methods, and `go test`). No database background. Every idea is introduced when it is needed.',
      ],
      callout: {
        kind: 'scope',
        title: 'Deliberately left out',
        body: [
          'Production engines also have a cost-based optimizer, indexes, nulls, outer joins, subqueries, prepared statements, and a vectorized or compiled executor. Each of those is a minor of its own. This one builds the pipeline they all start from.',
        ],
      },
    },
  ],
  takeaways: [
    'A query engine turns SQL text into rows. Storage is a separate problem.',
    'The stages are always lexer, parser, catalog check, then an executor of row operators.',
    'Scan, filter, project, join, aggregate, and sort are the operators. This minor runs them in the order the SQL was written.',
    'The dialect is small: INT and TEXT, CREATE, INSERT, and SELECT with WHERE, inner JOIN, GROUP BY, ORDER BY, and LIMIT.',
    'SQLite, Postgres, MySQL, DuckDB, and Spark SQL are the same pipeline at different sizes.',
  ],
};
