import type { ChapterReading } from './types';

/** Search index minor, chapter 00: documents to ranked hits. */
export const SEARCH_OVERVIEW: ChapterReading = {
  eyebrow: 'Search index · Chapter 00',
  title: 'Search: from documents to ranked hits',
  lede:
    'Start here before writing any code. We look at **what a full-text index actually stores**, how a query walks posting lists, how ranking picks an order, and exactly what you will build across the five chapters of this minor.',
  showBlogStamp: true,
  sections: [
    {
      id: 'what-it-is',
      title: 'What a search index is',
      body: [
        'A relational engine answers questions about rows you already structured. A **search index** answers questions about prose: which documents mention these words, and which ones should come first.',
        'The core structure is an **inverted index**: for each term, a sorted list of document ids (and usually a frequency). A query intersects or unions those lists, then scores the survivors.',
      ],
      subsections: [
        {
          id: 'not-sql',
          title: 'Not the query-engine minor',
          body: [
            'There is no SELECT, no join, no catalog of typed columns. Documents are opaque text. Tokens are the schema. Keep the two minors separate in your head: one is relational; this one is information retrieval.',
          ],
        },
        {
          id: 'where-it-runs',
          title: 'Where this shows up',
          body: [
            'Lucene, Elasticsearch, OpenSearch, and Solr are this idea at scale: analyzers, segments, merges, boolean retrieval, BM25. Your engine is one segment’s worth of honesty.',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'Forward vs inverted',
        body: [
          'A forward index maps document → terms. An inverted index maps term → documents. Search queries the inverted side. Indexing builds it from the forward side.',
        ],
      },
    },
    {
      id: 'pipeline',
      title: 'Index and query',
      body: ['Two paths share the analyzer.'],
      code: {
        language: 'plaintext',
        filename: 'flow',
        code: [
          '  Index:  doc text → tokens → postings → segment on disk',
          '  Query:  query text → tokens → AND/OR lists → BM25 → top k',
        ].join('\n'),
      },
      flows: [
        {
          title: 'Index path',
          steps: ['Document', 'Analyze', 'Postings', 'Flush segment'],
        },
        {
          title: 'Query path',
          steps: ['Query', 'Analyze', 'Boolean', 'Rank', 'Hits'],
        },
      ],
      after: [
        '**Analyze.** Lowercase, split, drop stopwords. Same function for docs and queries.',
        '**Postings.** `(docId, tf)` lists, sorted by doc id, written as a segment.',
        '**Index.** Assign ids, buffer, flush, keep a catalog.',
        '**Query.** AND intersects; OR unions. Lists stay sorted.',
        '**Rank.** BM25 uses term frequency, document length, and collection stats.',
      ],
    },
    {
      id: 'what-you-build',
      title: 'What you will build in this minor',
      body: [
        'Over five chapters you build **findx**, a small search engine in Go, Python, or C++. Tests add documents, run queries, and check hit ids and order.',
      ],
      table: {
        headers: ['Chapter', 'You build', 'Done when'],
        rows: [
          [
            '**01 · Analyze**',
            'Tokenizer and stopword filter',
            'Fixed strings produce a stable token list',
          ],
          [
            '**02 · Postings**',
            'In-memory map and on-disk segment codec',
            'A segment round-trips and stays sorted by doc id',
          ],
          [
            '**03 · Index**',
            'Add documents, flush, open from a directory',
            'Two flushes produce a readable multi-segment catalog',
          ],
          [
            '**04 · Query**',
            'Boolean AND and OR over postings',
            'Hand-computed hit sets match',
          ],
          [
            '**05 · Rank**',
            'BM25 scoring and top-k',
            'Order matches the reference on a fixed corpus',
          ],
          [
            '**06 · Benchmark** (coming soon)',
            'Your index against the reference on the same corpus',
            'Hits match, then you see how the time compares',
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
        '**Tests decide.** When `make test` passes, the chapter is complete.',
        '**Your code carries forward.** Each chapter starts from your own earlier work, with an opt-in reference solution if you get stuck.',
      ],
      after: [
        '**What you need:** comfortable in the language you pick (Go, Python, or C++). No IR background. Formulas appear when ranking does.',
      ],
      callout: {
        kind: 'scope',
        title: 'Deliberately left out',
        body: [
          'Phrase and positional queries, synonym filters, segment merges under load, distributed sharding, and learning-to-rank. Lucene has those. This minor builds analyzer → postings → boolean → BM25.',
        ],
      },
    },
  ],
  takeaways: [
    'Search indexes terms to documents. That inverted list is the heart of retrieval.',
    'The same analyzer must run on documents and on queries.',
    'Boolean operators combine sorted posting lists. Ranking orders the result.',
    'BM25 balances term frequency, document length, and how common a term is.',
    'Lucene-shaped systems are this pipeline with more segments and more query operators.',
  ],
};
