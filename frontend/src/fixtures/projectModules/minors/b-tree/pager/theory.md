## Where you are
<!-- mode: read-only -->

Chapter 00 laid out the machine: a B+ tree keeps every key in exactly one place, pages are updated in place, a write-ahead log makes that safe, and a buffer pool keeps hot pages in memory.

```plaintext
            Put / Delete / Get / Scan
                       │
              ┌────────▼────────┐
  ch 2, 5     │    B+ tree       │
              └────────┬────────┘
              ┌────────▼────────┐
  ch 4        │   Buffer pool    │
              └────────┬────────┘
              ┌────────▼────────┐        ┌──────────────┐
  ch 1        │      Pager       │ ◀──────│  you are here │
              └────────┬────────┘        └──────────────┘
                       ▼
                    data.db            wal.log (ch 3)
```

This chapter builds the bottom layer: the **pager**. Every layer above it speaks in page numbers. Nobody above the pager ever computes a byte offset.

> [!scope] This chapter's job
> Only the pager. No tree, no log, no cache. When you finish, you have a file that is an
> array of 4 KiB pages: you can allocate one, write it, read it back, detect damage,
> free it, and get it back from the freelist.

## Why pages
<!-- mode: read-only -->

### The disk speaks in blocks

A disk or SSD does not read one byte at a time. It reads and writes whole **blocks** (commonly 4 KiB), and the OS caches the file in blocks of that size too. Asking for 10 bytes costs the same as asking for 4096.

A B+ tree takes that seriously. Every node is exactly one **page**, sized to the block. A node is as wide as one block can be, so the tree is short, and one lookup touches one page per level.

| Engine | Default page size |
| --- | --- |
| PostgreSQL | 8 KiB |
| SQLite | 4 KiB |
| MySQL InnoDB | 16 KiB |
| This engine | 4 KiB |

### Page numbers instead of offsets

The file is an array of pages. Page `n` lives at byte `n × 4096`. A page number is a pointer on disk: an internal tree node stores the numbers of its children, and a leaf stores the number of its right sibling. Rewrite a page in place and every pointer to it stays valid.

```plaintext
  data.db
  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
  │ page 0  │ page 1  │ page 2  │ page 3  │ page 4  │ page 5  │ ...
  │ header  │         │         │         │         │         │
  └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
  offset 0   4096      8192      12288     16384     20480
```

Page 0 is the **header**: it records where the tree's root is, how many pages the file has, and the head of the freelist. It is never handed to a caller, so **page number 0 means "no page"** everywhere else. A leaf with no right sibling stores 0.

<!-- lang: go -->
The header layout, the `Meta` struct that mirrors it, and `Open`, `Sync`, and `Close` are given in `internal/pager/page.go` and `pager.go`. Read them first: they are about 100 lines.
<!-- /lang -->

## Checksummed pages
<!-- mode: read-and-implement tasks:1.1,1.2 -->

### A page can be damaged without anyone noticing

Disks do not always fail loudly. A power cut can leave a page half old and half new (a **torn write**), and bits do flip. If the engine reads such a page and trusts it, the damage spreads: a corrupted child pointer sends the tree somewhere random.

So every page ends with a **checksum**. The last 4 bytes hold a CRC-32C of the other 4092. On every write the pager computes it; on every read the pager checks it and refuses a page that fails.

```plaintext
  one page, 4096 bytes
  ┌──────────────────────────────────────────────┬────────────┐
  │ usable bytes (4092)                          │ crc32c (4) │
  │ the tree, the freelist, or the header live   │ of the     │
  │ here                                         │ left part  │
  └──────────────────────────────────────────────┴────────────┘
  0                                           Usable        PageSize
```

Callers see a `PageSize` buffer but own only the first `Usable` bytes. They never write the trailer. The pager does.

> [!tip] Why not trust the disk
> Postgres makes checksums optional, MySQL InnoDB does them by default, SQLite offers them
> as an extension. They all exist for the same reason: the cost of one CRC per page is
> tiny, and the cost of silently acting on garbage is not.

<!-- lang: go -->
### `TODO(1.1)` — `WritePage`

In `internal/pager/readwrite.go`:

1. `checkBuf(buf)` rejects a buffer that is not exactly `PageSize` bytes (given).
2. Copy `buf[:Usable]` into a local `var page [PageSize]byte`. Do **not** write into the caller's buffer: callers reuse it, and a test checks it.
3. Compute `crc32.Checksum(page[:Usable], crcTable)` and store it in `page[Usable:]` with `binary.LittleEndian.PutUint32`.
4. Write all of `page` at offset `int64(no) * PageSize` with `p.f.WriteAt`.

You will need to import `encoding/binary` and `hash/crc32`.

### `TODO(1.2)` — `ReadPage`

In the same file:

1. `checkBuf(buf)`, then `n, err := p.f.ReadAt(buf, int64(no)*PageSize)`.
2. If `n < PageSize`, the page is not all there. A read past the end of the file reports `io.EOF`: return an error that wraps `ErrBadPage` (`fmt.Errorf("%w: ...", ErrBadPage)`). Any other error is a real I/O error; return it as is.
3. Compare the trailer, `binary.LittleEndian.Uint32(buf[Usable:])`, with `crc32.Checksum(buf[:Usable], crcTable)`. On a mismatch return an error that wraps `ErrChecksum`.

You will need to import `errors`, `fmt`, and `io` as well.

> [!scope] No locking here
> `ReadAt` and `WriteAt` are safe to call from many goroutines at once, so `ReadPage` and
> `WritePage` take no lock. Only the header state (`Meta`) needs one.
<!-- /lang -->

### Write is not durable

`WritePage` hands the bytes to the OS. They are durable only after an `fsync`. The pager's `Sync` does that for the header and the file. Chapter 3 is about what to do about the window in between.

## Allocating and freeing pages
<!-- mode: read-and-implement tasks:1.3,1.4 -->

### Who owns page 17?

The tree needs new pages when it splits, and gives pages back when it merges. Something has to hand out page numbers, and it must not hand out one that is in use. The pager keeps two numbers in the header for this:

- `PageCount`: how many pages the file has. A page at or past it does not exist yet.
- `FreeHead`: the first page of the **freelist**, or 0 when it is empty.

### The freelist lives inside the free pages

You do not need a separate structure to remember which pages are free. A free page has bytes to spare, so it stores the number of the *next* free page. The header points at the first. The list is a stack: the last page freed is the first one reused.

```plaintext
  header:  FreeHead = 7

  page 7 [FREE | next=3]  ──▶  page 3 [FREE | next=9]  ──▶  page 9 [FREE | next=0]
```

| Call | Freelist empty | Freelist not empty |
| --- | --- | --- |
| `Allocate` | return `PageCount`, write a blank page there, `PageCount++` | pop the head: read it, `FreeHead = its next`, return it |
| `Free(n)` | page `n` becomes `[FREE next=0]`, `FreeHead = n` | page `n` becomes `[FREE next=old head]`, `FreeHead = n` |

> [!warn] A freed page is not zeroed for the caller
> A recycled page keeps its old bytes until somebody writes it. Callers always write a
> page before they read it. A recycled page costs no I/O at all on `Allocate`: that is
> deliberate, because chapter 3 will rely on `Allocate` not changing anything on disk.

<!-- lang: go -->
### `TODO(1.3)` — `Allocate`

In `internal/pager/alloc.go`. The mutex is already held for you.

- Free page available (`p.meta.FreeHead != 0`): read that page into a `PageSize` buffer, `next, err := decodeFreePage(buf)`, set `p.meta.FreeHead = next`, and return the page you popped. **Do not write to disk.**
- Otherwise: `no := p.meta.PageCount`, `WritePage(no, make([]byte, PageSize))` so the file really grows, `p.meta.PageCount++`, return `no`.

### `TODO(1.4)` — `Free`

In the same file, with the mutex already held:

1. If `no == 0` or `no >= p.meta.PageCount`, return an error that wraps `ErrBadPage`. Page 0 is the header; a page past the end does not exist.
2. `buf := make([]byte, PageSize)`, then `EncodeFreePage(buf, p.meta.FreeHead)`.
3. `WritePage(no, buf)`, and only if that succeeded `p.meta.FreeHead = no`.

`EncodeFreePage` is exported because chapter 3 logs freed pages exactly as `Free` writes them.
<!-- /lang -->

> [!warn] Free a page twice and the list loops
> If page 7 is freed twice, it points at itself and the next two `Allocate` calls both
> return it. The pager cannot cheaply detect that, so the tree must free each page once.
> Chapter 5 is careful about it.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL over your pager
```
<!-- /lang -->

Try the REPL:

```plaintext
> alloc
page 1
> alloc
page 2
> write 1 hello
OK
> read 1
"hello"
> free 1
OK
> alloc
page 1
> meta
root=0 pages=3 freelist head=0
```

To see the checksum work, quit, flip one byte in the middle of page 1 with a hex editor (or `printf '\xff' | dd of=data.db bs=1 seek=4200 conv=notrunc`), start the REPL again, and `read 1`:

```plaintext
> read 1
error: pager: page checksum mismatch: page 1
```

> [!check] Before you move on
> Say these out loud:
>
> 1. The file is an array of 4 KiB pages; a page number is an on-disk pointer.
> 2. Page 0 is the header, so page number 0 means "no page".
> 3. The last 4 bytes of every page are a CRC-32C, written by `WritePage` and checked by `ReadPage`.
> 4. The freelist is stored in the free pages themselves, and `Allocate` and `Free` are a stack push and pop.

### What is missing

The pager gives you pages. It has no idea what is in them. Chapter 2 builds a **B+ tree** whose nodes are pages: search walks from the root to a leaf through page numbers, insert fills a leaf, and a full leaf splits in two and pushes a separator up.
