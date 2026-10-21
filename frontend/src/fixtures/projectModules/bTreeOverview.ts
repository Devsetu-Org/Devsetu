import type { ChapterReading } from './types';

/** B-tree minor, chapter 00: what a B+ tree engine is, where it runs, and the plan. */
export const B_TREE_OVERVIEW: ChapterReading = {
  eyebrow: 'B-tree · Chapter 00',
  title: 'B-trees: the engine behind update-in-place databases',
  lede:
    'Start here before writing any code. We first look at **how storage engines are built in general**, and at the two designs nearly all of them use: **B-trees** and **LSM trees**. Then we dig into the B-tree: how a B+ tree stays balanced, where it runs, the problems it causes in production, and exactly what you will build across the five chapters of this minor.',
  showBlogStamp: true,
  sections: [
    {
      id: 'storage-engines',
      title: 'What a storage engine is',
      body: [
        'Every database has two halves. The top half understands queries: it parses SQL, plans joins, runs transactions, and replicates data. The bottom half is the **storage engine**: the part that puts bytes on disk and finds them again.',
        'The interface between the two is surprisingly small. Underneath all the SQL, the engine is asked to **put** a key and value, **get** a key, **delete** a key, and **scan** a range of keys in sorted order. MySQL makes the split visible: the same SQL layer can run on **InnoDB** (a B-tree) or on **MyRocks** (an LSM tree). MongoDB runs on **WiredTiger**; CockroachDB runs on **Pebble**; etcd, which stores all Kubernetes state, runs on **bbolt**.',
      ],
      subsections: [
        {
          id: 'what-engines-must-do',
          title: 'What every engine has to get right',
          body: [
            '**Durability.** Once a write is acknowledged, a crash or power cut must not lose it.',
            '**Fast lookups.** Find one key among billions without reading everything.',
            '**Order.** Keep keys sorted, so a range scan ("all orders from today") reads neighbouring data instead of the whole store.',
            '**Space.** Reclaim the room taken by deleted and overwritten data.',
          ],
        },
        {
          id: 'the-problem',
          title: 'The constraint they all fight: random writes',
          body: [
            'Disks, both SSDs and spinning drives, handle **sequential** writes far better than **random** ones. A spinning disk pays a physical seek of several milliseconds for every random write. An SSD cannot overwrite a page directly; it erases and rewrites whole blocks, so scattered small writes cause extra internal copying and wear.',
            'So the cheapest possible write is "append to the end of a file". The expensive one is "go find the right spot somewhere on disk and change it".',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'One question splits the field',
        body: [
          'When a key changes, does the engine **rewrite it where it lives**, or **append the new version somewhere else** and clean up later? Nearly every engine answers one way or the other. Updating in place gives you the **B-tree**; appending and merging gives you the **LSM tree**. The sister minor, **LSM tree**, builds the second answer. This minor builds the first.',
        ],
      },
    },
    {
      id: 'lsm-briefly',
      title: 'LSM trees: append, then merge',
      body: [
        'A **log-structured merge tree** never changes data where it lies. Writes collect in a sorted buffer in memory. When the buffer fills, it is written to disk in one sequential pass as a sorted, read-only file. Over time, a background process merges those files together.',
      ],
      code: {
        language: 'plaintext',
        filename: 'an LSM tree',
        code: [
          '   put("k") → [ memtable, sorted, in memory ] ──flush──▶  file 3   (newest)',
          '                                                          file 2',
          '                                                          file 1   (oldest)',
          '',
          '   get("k"):  memtable → file 3 → file 2 → file 1     (first answer wins)',
          '   background: merge files 1–3 into one, keep the newest version of each key',
        ].join('\n'),
      },
      after: [
        'Every write is cheap and sequential. The catch is that one key can exist in several places at once, so a read may have to look in several of them, and the merging never stops. That is the LSM minor. Here we take the other trade.',
      ],
    },
    {
      id: 'what-is-a-btree',
      title: 'B-trees: update in place',
      body: [
        'A B-tree stores data in fixed-size **pages**, typically 4 to 16 KiB, arranged as a tree. Leaf pages hold the keys and values in sorted order. The pages above them hold only separator keys and pointers that say which child page covers which range.',
        'Most databases use the **B+ tree** variant described here, and everyone still calls it a B-tree. In a B+ tree the values live only in the leaves; the internal pages are a pure directory. Leaves are also linked sideways, so a range scan walks neighbours instead of climbing the tree again.',
      ],
      code: {
        language: 'plaintext',
        filename: 'a B+ tree',
        code: [
          '                    [ root:   g   |   p ]',
          '                   /          |          \\',
          '   [ a b c d e f ] ←→ [ g h i … o ] ←→ [ p q r … z ]   ← leaves, linked',
          '',
          '   get("k"):  root → middle leaf → found       (one path, one place)',
          '   put("k"):  same path, change the leaf page where it is',
        ].join('\n'),
      },
      subsections: [
        {
          id: 'why-wide',
          title: 'Why the tree is so shallow',
          body: [
            'Each page holds hundreds of pointers, so the tree is very wide and very shallow: three or four levels cover billions of keys. The top levels are small enough to stay in memory, so a lookup usually costs one or two disk reads after the root is cached.',
          ],
        },
        {
          id: 'a-write',
          title: 'What a write does',
          body: [
            'A put follows the same path down to the one leaf that owns the key and changes that page. The change is recorded in a **write-ahead log** first; the page itself is written back to disk later, often through a **buffer pool** that keeps hot pages in RAM.',
            'When a leaf fills, it **splits** in two and the parent gets a new separator key. That is how the tree grows, and why pages sit partly empty afterwards. The cost of a 100-byte update is that a whole 8 KiB page becomes dirty.',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'The trade a B-tree makes',
        body: [
          'Every key lives in exactly one place, so **reads are fast and predictable**. The price is that a stream of writes to random keys becomes a stream of **random page writes**, and a small change dirties a whole page.',
        ],
      },
    },
    {
      id: 'side-by-side',
      title: 'B-tree vs LSM tree, side by side',
      body: [
        'The two designs make opposite trades, which is why both are everywhere.',
      ],
      table: {
        headers: ['', 'B-tree', 'LSM tree'],
        rows: [
          ['**A write**', 'Find the page, change it in place', 'Append to a log, insert into a memory buffer'],
          ['**Disk pattern**', 'Random page writes', 'Large sequential file writes'],
          ['**Where a key lives**', 'Exactly one page', 'Memory plus possibly several files'],
          ['**Point lookup**', 'One root-to-leaf path', 'Check memory, then files newest first; filters skip most files'],
          ['**Range scan**', 'Walk neighbouring leaf pages', 'Merge sorted streams from every file'],
          ['**Delete**', 'Remove the key; maybe merge pages', 'Write a tombstone that hides older versions'],
          ['**Background work**', 'Little (checkpoints, eviction)', 'Compaction, all the time'],
          ['**Space**', 'Half-empty pages after splits', 'Old versions until compaction; compresses well'],
          ['**Weak spot**', 'Heavy random writes', 'Read latency and compaction spikes'],
        ],
      },
      after: [
        'Engineers describe the trade with three kinds of **amplification**: extra bytes written to disk per byte the application writes (**write**), extra places checked per lookup (**read**), and extra disk used per byte of live data (**space**). B-trees keep read amplification low and pay in write amplification. LSM trees do the reverse. No design is best at all three at once.',
      ],
      tableAfter: {
        headers: ['B-trees are usually better at', 'LSM trees shine at'],
        rows: [
          ['Read-heavy workloads with many point lookups', 'Write-heavy workloads: logs, metrics, events, messages'],
          ['Predictable read latency on every query', 'Ingesting data faster than random I/O allows'],
          ['Frequent in-place updates of the same rows', 'Compact storage, since files are rewritten and compressed'],
        ],
      },
      callout: {
        kind: 'tip',
        title: 'The workload decides',
        body: [
          'Because MySQL can run either engine under the same SQL, the choice is easy to see in practice: Meta moved much of its MySQL fleet from InnoDB (a B-tree) to MyRocks (an LSM tree), largely to cut storage. The rest of this minor is about the B-tree side, built piece by piece.',
        ],
      },
    },
    {
      id: 'how-it-works',
      title: 'How the pieces fit together',
      body: [
        'A B+ tree alone is not a storage engine. Around it sit a pager that owns the page file, a write-ahead log for durability, and a buffer pool that caches pages. Each box below is one chapter of this minor.',
      ],
      flows: [
        {
          title: 'Write path',
          steps: [
            '`Put` / `Delete`',
            'Append to the **write-ahead log**',
            '**Buffer pool** pins the leaf',
            'Change the page in memory',
            'Unpin (dirty); flush later',
          ],
        },
        {
          title: 'Read path',
          steps: ['`Get`', '**Buffer pool**', 'Walk the **B+ tree**', 'One leaf holds the answer'],
        },
        {
          title: 'Underneath',
          steps: ['**Pager** owns the page file', 'Allocate / free pages', 'Read and write whole pages'],
        },
      ],
      after: [
        '**Pager.** The data file is an array of fixed-size pages. The pager allocates free pages, frees unused ones into a freelist, and reads or writes a page by number.',
        '**B+ tree.** Internal pages hold separators and child pointers. Leaves hold keys and values and link left and right. Inserts that fill a leaf split it; deletes that empty one may merge.',
        '**Write-ahead log (WAL).** Every change is appended to a log before the dirty page is allowed to become durable. On crash, the log is replayed onto the pages.',
        '**Buffer pool.** A fixed number of frames hold hot pages in memory. Pinning a page keeps it there while you use it; unpinning lets the clock hand evict it. Dirty pages are written through the pager only after their log records are durable.',
        '**Mutations.** Deletes remove a key from its leaf. An underfull leaf borrows from a sibling or merges, and a separator may be pulled out of the parent. Range scans walk the leaf chain.',
      ],
      callout: {
        kind: 'tip',
        title: 'The page is the unit of I/O',
        body: [
          'Almost every cost in this design is measured in pages: a lookup costs a few page reads, a write dirties one page (sometimes two when a split happens), and the buffer pool decides which pages stay in RAM. Thinking in pages is the whole game.',
        ],
      },
    },
    {
      id: 'where-its-used',
      title: 'Where B-trees run',
      body: [
        'Bayer and McCreight published the B-tree in 1970. The B+ tree variant, with all data in the leaves, became the default for relational databases. Today it sits underneath many of the systems you will run in production:',
      ],
      table: {
        headers: ['System', 'What it is', 'How the B-tree shows up'],
        rows: [
          ['**PostgreSQL**', 'Relational database', 'Heap tables plus B-tree indexes (and other index types) on top.'],
          ['**MySQL InnoDB**', 'MySQL’s default storage engine', 'Clustered B+ tree: the primary key order is the row order on disk.'],
          ['**SQLite**', 'Embedded SQL database', 'A single file of B-tree pages; almost every table and index is one.'],
          ['**Oracle**, **SQL Server**', 'Commercial relational databases', 'B-tree indexes (and variants) as the primary access path.'],
          ['**WiredTiger**', 'MongoDB’s storage engine', 'B-tree (and LSM-ish) tables; the document store’s durable core.'],
          ['**LMDB**, **bbolt**', 'Embedded key/value libraries', 'Copy-on-write B+ trees. etcd stores all Kubernetes state in bbolt.'],
          ['**WinFS / NTFS**, **HFS+**', 'File systems', 'Directories and extents indexed with B-trees.'],
        ],
      },
      after: [
        'The same "fixed-size pages, separators, balanced tree" idea shows up beyond databases: file systems, search indexes, and even some key/value layers inside larger engines.',
      ],
    },
    {
      id: 'why-it-matters',
      title: 'Why this matters if you run these systems',
      body: [
        'You do not have to write a database to need this. Many of the classic operational problems with Postgres, InnoDB, or SQLite are B-tree behaviour showing through:',
      ],
      bullets: [
        '**Buffer pool pressure.** When the working set no longer fits in shared_buffers or the InnoDB buffer pool, every query starts reading pages from disk and latency climbs.',
        '**Write amplification on updates.** Changing one column still dirties a whole page (and often its index pages). A small OLTP update can write far more than the row itself.',
        '**Page splits under insert load.** Bulk inserts into the middle of a key space split leaves constantly, leave pages half empty, and push random I/O.',
        '**Index bloat.** Deletes leave empty space that is not always reused quickly; vacuum and reindex exist because B-trees do not rewrite themselves the way LSM compaction does.',
        '**Checkpoint and dirty-page storms.** Flushing many dirty pages at once can stall the machine. Engines spread checkpoints carefully for a reason.',
      ],
      after: [
        'After this minor these stop being mysterious tuning knobs. You will have written each mechanism that causes them.',
      ],
    },
    {
      id: 'vocabulary',
      title: 'The words you will use',
      body: ['Every chapter uses these terms. Come back here whenever one is fuzzy.'],
      table: {
        headers: ['Term', 'Meaning'],
        rows: [
          ['**Page**', 'Fixed-size unit of disk I/O, typically 4 or 8 KiB'],
          ['**Pager**', 'Owns the page file: allocate, free, read, and write pages by number'],
          ['**Freelist**', 'Linked list of unused page numbers ready to be reused'],
          ['**Leaf**', 'A page that holds keys and values (and sibling links in a B+ tree)'],
          ['**Internal page**', 'A page that holds only separator keys and child page numbers'],
          ['**Split**', 'Turning one full page into two and pushing a separator up'],
          ['**Merge / borrow**', 'Fixing an underfull page after deletes by combining or stealing from a sibling'],
          ['**Write-ahead log (WAL)**', 'Append-only file of every change, replayed after a crash'],
          ['**Buffer pool**', 'Fixed set of memory frames that cache hot pages'],
          ['**Pin / unpin**', 'Marking a frame in use so eviction cannot steal it mid-operation'],
          ['**Dirty page**', 'A page whose in-memory copy differs from disk; must be logged before it is flushed'],
        ],
      },
    },
    {
      id: 'what-you-build',
      title: 'What you will build in this minor',
      body: [
        'Over five chapters you build **btreekv**, a working B+ tree storage engine in Go, starting from an almost empty repository. Each chapter adds one box from the diagrams above, and each ends with tests that prove it works.',
      ],
      table: {
        headers: ['Chapter', 'You build', 'Done when'],
        rows: [
          [
            '**01 · Pager**',
            'A page file with allocate, free, read, and write',
            'Pages round-trip intact, freed pages are reused, and a crash cannot leave a torn page the engine trusts',
          ],
          [
            '**02 · B+ tree**',
            'Search, insert, and split over the pager',
            'Random puts match a reference map, and a lookup walks a short root-to-leaf path',
          ],
          [
            '**03 · Write-ahead log**',
            'Checksummed log records, append before acknowledging, replay on open',
            'Kill the process mid-write, restart, and nothing that was acknowledged is lost',
          ],
          [
            '**04 · Buffer pool**',
            'Pin, unpin, clock eviction, and dirty flush',
            'A small pool serves a large tree without losing correctness, and dirty pages hit the log before disk',
          ],
          [
            '**05 · Mutations**',
            'Delete with borrow or merge, leaf-linked range scans',
            'Deletes reclaim space, scans return keys in order, and Put / Get / Delete / Scan all pass',
          ],
          [
            '**06 · Benchmark** (coming soon)',
            'Tune or rework your engine, then run it against ours on the same machines and data',
            'You get a report of how your design choices compare with the reference',
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
        '**Small tasks.** A chapter has two to four tasks, and each turns green as you finish it, so progress shows up long before the chapter is done.',
        '**Tests decide.** When `make test` passes, the chapter is complete.',
        '**Your code carries forward.** Each chapter adds only the files it needs and starts from your own code for the earlier ones. Stuck on one? You can switch that chapter to our reference solution and keep going.',
      ],
      after: [
        '**What you need:** comfortable Go (slices, maps, structs, methods, and `go test`). No database or storage background; every idea is introduced when it is needed.',
      ],
      callout: {
        kind: 'scope',
        title: 'Deliberately left out',
        body: [
          'Production engines also have latch-free concurrency, multi-version concurrency control, compression, and ARIES-style recovery with compensation logs. They are worth knowing about, but each would double the size of a chapter. This minor builds the core all of them sit on.',
        ],
      },
    },
  ],
  takeaways: [
    'A storage engine is the part of a database that puts keys on disk and finds them again: put, get, delete, scan.',
    'B-trees update fixed-size pages in place, so every key lives in one place and reads are predictable, but random writes are expensive.',
    'A B+ tree keeps values in the leaves, separators in the internal pages, and links leaves sideways for range scans.',
    'Around the tree sit a pager, a write-ahead log, and a buffer pool: without them it is a data structure, not an engine.',
    'Postgres, InnoDB, SQLite, WiredTiger, LMDB, and bbolt are all built this way, and their classic production problems are B-tree behaviour.',
    'Across five chapters you build each piece in Go: pager, B+ tree, write-ahead log, buffer pool, and mutations.',
  ],
};
