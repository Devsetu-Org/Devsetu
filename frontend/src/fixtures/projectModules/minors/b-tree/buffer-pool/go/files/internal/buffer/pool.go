// Package buffer is the buffer pool: a fixed number of in-memory frames that
// cache pages from the layer below. Hot pages stay in memory, cold ones are
// evicted by a clock hand, and a dirty page is written back only once the log
// that describes it is on disk.
package buffer

import (
	"errors"
	"sync"

	"github.com/devlabs/btreekv/internal/pager"
)

// ErrPoolFull is returned when every frame is pinned, so there is nothing to
// evict.
var ErrPoolFull = errors.New("buffer: every frame is pinned")

// Backing is the page layer under the pool; *pager.Pager implements it.
type Backing interface {
	ReadPage(no pager.PageNo, buf []byte) error
	WritePage(no pager.PageNo, buf []byte) error
	Allocate() (pager.PageNo, error)
	Free(no pager.PageNo) error
	Meta() pager.Meta
	SetMeta(pager.Meta)
}

// Log is the part of the write-ahead log the pool needs: how far it has been
// written, and how far it is known to be on disk. *wal.Writer implements it.
type Log interface {
	Size() int64
	Durable() int64
	Sync() error
}

var _ Backing = (*pager.Pager)(nil)

// Frame holds one cached page. While a frame is pinned the pool will not evict
// it and No and Data are safe to use; after Unpin they may be reused for
// another page.
type Frame struct {
	No   pager.PageNo
	Data [pager.PageSize]byte

	used  bool  // holds a page
	pins  int   // callers using the frame right now
	ref   bool  // used since the clock hand last passed
	dirty bool  // Data differs from the page on disk
	lsn   int64 // log size when the frame was last dirtied
}

// Pool is a buffer pool. It is safe for concurrent use.
type Pool struct {
	mu     sync.Mutex // guards everything below, and every Frame's metadata
	b      Backing
	log    Log
	frames []Frame
	table  map[pager.PageNo]int // page number -> index in frames
	hand   int                  // clock hand: next frame the sweep looks at
}

// New returns a pool of the given number of frames (at least 2) over b.
func New(b Backing, frames int) *Pool {
	frames = max(frames, 2)
	return &Pool{b: b, frames: make([]Frame, frames), table: make(map[pager.PageNo]int, frames)}
}

// SetLog tells the pool which log protects its pages. Until it is set, pages
// are written back whenever they are evicted.
func (p *Pool) SetLog(l Log) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.log = l
}

// logSize is the log's current size, or 0 without a log. Callers hold p.mu.
func (p *Pool) logSize() int64 {
	if p.log == nil {
		return 0
	}
	return p.log.Size()
}

// Fetch returns the frame holding page no, reading it in if needed, and pins
// it. Every Fetch must be paired with an Unpin.
func (p *Pool) Fetch(no pager.PageNo) (*Frame, error) { return p.pin(no, true) }

// FlushAll writes every dirty page back (log first, as always).
func (p *Pool) FlushAll() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	for i := range p.frames {
		if f := &p.frames[i]; f.used {
			if err := p.flushFrame(f); err != nil {
				return err
			}
		}
	}
	return nil
}

// Resident is the number of pages cached right now.
func (p *Pool) Resident() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.table)
}

// Dirty is the number of cached pages that differ from the page file.
func (p *Pool) Dirty() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	n := 0
	for i := range p.frames {
		if p.frames[i].used && p.frames[i].dirty {
			n++
		}
	}
	return n
}

// ---- the PageIO the rest of the engine sees ----

// ReadPage copies page no into buf (PageSize bytes), through the cache.
func (p *Pool) ReadPage(no pager.PageNo, buf []byte) error {
	f, err := p.pin(no, true)
	if err != nil {
		return err
	}
	copy(buf, f.Data[:])
	p.Unpin(f, false)
	return nil
}

// WritePage replaces the cached copy of page no with buf and marks it dirty.
// The page is not read first, since it is about to be overwritten, so it does
// not even have to exist in the file yet. It reaches the file on eviction or
// FlushAll.
func (p *Pool) WritePage(no pager.PageNo, buf []byte) error {
	f, err := p.pin(no, false)
	if err != nil {
		return err
	}
	copy(f.Data[:pager.Usable], buf[:pager.Usable])
	p.Unpin(f, true)
	return nil
}

// Allocate hands out a page number. The head of the freelist may still be
// sitting dirty in the cache (a page freed moments ago), and the pager reads it
// from the file, so write it back first.
func (p *Pool) Allocate() (pager.PageNo, error) {
	p.mu.Lock()
	if head := p.b.Meta().FreeHead; head != 0 {
		if i, ok := p.table[head]; ok {
			if err := p.flushFrame(&p.frames[i]); err != nil {
				p.mu.Unlock()
				return 0, err
			}
		}
	}
	p.mu.Unlock()
	return p.b.Allocate()
}

// Free drops any cached copy of page no and puts it on the freelist.
func (p *Pool) Free(no pager.PageNo) error {
	p.mu.Lock()
	if i, ok := p.table[no]; ok && p.frames[i].pins == 0 {
		p.frames[i] = Frame{}
		delete(p.table, no)
	}
	p.mu.Unlock()
	return p.b.Free(no)
}

func (p *Pool) Meta() pager.Meta     { return p.b.Meta() }
func (p *Pool) SetMeta(m pager.Meta) { p.b.SetMeta(m) }
func (p *Pool) Root() pager.PageNo   { return p.b.Meta().Root }
func (p *Pool) SetRoot(no pager.PageNo) {
	m := p.b.Meta()
	m.Root = no
	p.b.SetMeta(m)
}
