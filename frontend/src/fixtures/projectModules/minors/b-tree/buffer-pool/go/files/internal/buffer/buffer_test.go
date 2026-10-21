package buffer

import (
	"bytes"
	"fmt"
	"math/rand"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/devlabs/btreekv/internal/pager"
)

// spy wraps a real pager and records every page read and write, in order.
type spy struct {
	*pager.Pager
	mu     sync.Mutex
	events []string
}

func (s *spy) note(e string) {
	s.mu.Lock()
	s.events = append(s.events, e)
	s.mu.Unlock()
}

func (s *spy) ReadPage(no pager.PageNo, buf []byte) error {
	s.note(fmt.Sprintf("read %d", no))
	return s.Pager.ReadPage(no, buf)
}

func (s *spy) WritePage(no pager.PageNo, buf []byte) error {
	s.note(fmt.Sprintf("write %d", no))
	return s.Pager.WritePage(no, buf)
}

func (s *spy) count(e string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, x := range s.events {
		if x == e {
			n++
		}
	}
	return n
}

func (s *spy) countPrefix(prefix string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, x := range s.events {
		if strings.HasPrefix(x, prefix) {
			n++
		}
	}
	return n
}

func (s *spy) reset() {
	s.mu.Lock()
	s.events = nil
	s.mu.Unlock()
}

// fakeLog is a log whose durability the test controls.
type fakeLog struct {
	s            *spy
	size, synced int64
}

func (l *fakeLog) Size() int64    { return l.size }
func (l *fakeLog) Durable() int64 { return l.synced }
func (l *fakeLog) Sync() error {
	l.s.note("log sync")
	l.synced = l.size
	return nil
}

func pageOf(b byte) []byte {
	buf := make([]byte, pager.PageSize)
	for i := 0; i < pager.Usable; i++ {
		buf[i] = b
	}
	return buf
}

// newSpy makes a file with pages 1..n holding the byte i in every position.
func newSpy(t *testing.T, n int) *spy {
	t.Helper()
	pg, err := pager.Open(filepath.Join(t.TempDir(), "data.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pg.Close() })
	for i := 1; i <= n; i++ {
		no, err := pg.Allocate()
		if err != nil || int(no) != i {
			t.Fatalf("Allocate = %d, %v", no, err)
		}
		if err := pg.WritePage(no, pageOf(byte(i))); err != nil {
			t.Fatal(err)
		}
	}
	return &spy{Pager: pg}
}

func touch(t *testing.T, p *Pool, no pager.PageNo) {
	t.Helper()
	f, err := p.Fetch(no)
	if err != nil {
		t.Fatalf("Fetch(%d): %v", no, err)
	}
	p.Unpin(f, false)
}

func TestFetchReadsOnceThenHits(t *testing.T) {
	s := newSpy(t, 3)
	p := New(s, 4)
	s.reset()
	f, err := p.Fetch(2)
	if err != nil {
		t.Fatal(err)
	}
	if f.No != 2 || f.Data[0] != 2 || f.Data[pager.Usable-1] != 2 {
		t.Fatalf("frame holds page %d with first byte %d, want page 2 full of 2s", f.No, f.Data[0])
	}
	p.Unpin(f, false)
	touch(t, p, 2)
	touch(t, p, 2)
	if got := s.count("read 2"); got != 1 {
		t.Fatalf("page 2 was read %d times; a cached page must not be read again", got)
	}
	if p.Resident() != 1 {
		t.Fatalf("Resident = %d, want 1", p.Resident())
	}
}

func TestSamePageSameFrame(t *testing.T) {
	s := newSpy(t, 2)
	p := New(s, 4)
	a, _ := p.Fetch(1)
	b, _ := p.Fetch(1)
	if a != b {
		t.Fatal("two fetches of one page returned different frames")
	}
	p.Unpin(a, false)
	p.Unpin(b, false)
}

func TestPinnedFramesAreNeverEvicted(t *testing.T) {
	s := newSpy(t, 4)
	p := New(s, 2)
	f1, _ := p.Fetch(1)
	f2, err := p.Fetch(2)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := p.Fetch(3); err != ErrPoolFull {
		t.Fatalf("Fetch with every frame pinned = %v, want ErrPoolFull", err)
	}
	p.Unpin(f1, false)
	f3, err := p.Fetch(3)
	if err != nil {
		t.Fatalf("Fetch after an Unpin: %v", err)
	}
	if f2.No != 2 || f2.Data[0] != 2 {
		t.Fatal("the pinned frame was reused for another page")
	}
	p.Unpin(f2, false)
	p.Unpin(f3, false)
}

func TestPinCountsNest(t *testing.T) {
	s := newSpy(t, 3)
	p := New(s, 2)
	a, _ := p.Fetch(1)
	b, _ := p.Fetch(1)
	p.Unpin(a, false)
	// Still pinned once: fill the other frame, then ask for a third page.
	touch(t, p, 2)
	if _, err := p.Fetch(3); err != nil {
		t.Fatalf("Fetch(3): %v (page 2's frame is free to evict)", err)
	}
	if b.No != 1 || b.Data[0] != 1 {
		t.Fatal("a page with one pin left was evicted")
	}
}

func TestUnpinTwicePanics(t *testing.T) {
	s := newSpy(t, 1)
	p := New(s, 2)
	f, _ := p.Fetch(1)
	p.Unpin(f, false)
	defer func() {
		if recover() == nil {
			t.Fatal("a second Unpin should panic")
		}
	}()
	p.Unpin(f, false)
}

func TestClockGivesASecondChance(t *testing.T) {
	s := newSpy(t, 5)
	p := New(s, 3)
	for _, no := range []pager.PageNo{1, 2, 3} {
		touch(t, p, no)
	}
	touch(t, p, 4) // sweep clears every ref bit, then evicts page 1
	touch(t, p, 2) // page 2 is used again: its ref bit is set
	touch(t, p, 5) // the hand reaches page 2 first, spares it, and evicts page 3
	s.reset()
	touch(t, p, 2)
	if s.count("read 2") != 0 {
		t.Fatal("page 2 was evicted although it was used after the last sweep")
	}
	touch(t, p, 3)
	if s.count("read 3") != 1 {
		t.Fatal("page 3 should have been the victim: it was not used after the sweep cleared it")
	}
}

func TestDirtyPageIsWrittenBackOnEviction(t *testing.T) {
	s := newSpy(t, 4)
	p := New(s, 2)
	f, _ := p.Fetch(1)
	f.Data[0] = 0x77
	p.Unpin(f, true)
	touch(t, p, 2)
	s.reset()
	touch(t, p, 3)
	touch(t, p, 4)
	if s.count("write 1") != 1 {
		t.Fatalf("events %v: the dirty page 1 must be written exactly once when evicted", s.events)
	}
	if s.countPrefix("write ") != 1 {
		t.Fatalf("events %v: clean pages must be evicted without a write", s.events)
	}
	got := make([]byte, pager.PageSize)
	if err := s.Pager.ReadPage(1, got); err != nil || got[0] != 0x77 {
		t.Fatalf("page 1 on disk: first byte %#x, err %v; want the modified 0x77", got[0], err)
	}
	// And it can be fetched back with the change.
	f, _ = p.Fetch(1)
	if f.Data[0] != 0x77 {
		t.Fatalf("refetched page 1 starts with %#x, want 0x77", f.Data[0])
	}
	p.Unpin(f, false)
}

func TestEvictedPageIsNotDirtyAgain(t *testing.T) {
	s := newSpy(t, 3)
	p := New(s, 2)
	f, _ := p.Fetch(1)
	p.Unpin(f, true)
	touch(t, p, 2)
	touch(t, p, 3) // evicts 1, writing it
	touch(t, p, 1) // reload (evicts something clean or 2)
	touch(t, p, 2)
	touch(t, p, 3)
	if n := s.count("write 1"); n != 1 {
		t.Fatalf("page 1 was written %d times, want 1: once clean it must not be written again", n)
	}
}

func TestFlushWaitsForTheLog(t *testing.T) {
	s := newSpy(t, 3)
	l := &fakeLog{s: s, size: 100, synced: 40}
	p := New(s, 2)
	p.SetLog(l)
	f, _ := p.Fetch(1)
	f.Data[0] = 9
	p.Unpin(f, true) // dirtied while the log is 100 bytes long
	touch(t, p, 2)
	s.reset()
	touch(t, p, 3) // evicts dirty page 1

	var sync, write = -1, -1
	for i, e := range s.events {
		if e == "log sync" && sync < 0 {
			sync = i
		}
		if e == "write 1" {
			write = i
		}
	}
	if write < 0 {
		t.Fatalf("events %v: page 1 was never written", s.events)
	}
	if sync < 0 || sync > write {
		t.Fatalf("events %v: the log must be synced before the page it describes is written", s.events)
	}
	if l.synced != 100 {
		t.Fatalf("log durable up to %d, want 100", l.synced)
	}
}

func TestNoLogSyncWhenAlreadyDurable(t *testing.T) {
	s := newSpy(t, 3)
	l := &fakeLog{s: s, size: 100, synced: 100}
	p := New(s, 2)
	p.SetLog(l)
	f, _ := p.Fetch(1)
	p.Unpin(f, true)
	touch(t, p, 2)
	touch(t, p, 3)
	if s.count("write 1") != 1 {
		t.Fatalf("events %v", s.events)
	}
	if s.count("log sync") != 0 {
		t.Fatalf("events %v: the log was already durable, syncing it again wastes an fsync", s.events)
	}
}

func TestFlushAll(t *testing.T) {
	s := newSpy(t, 4)
	p := New(s, 8)
	for _, no := range []pager.PageNo{1, 2, 3} {
		f, _ := p.Fetch(no)
		f.Data[1] = 0xEE
		p.Unpin(f, true)
	}
	touch(t, p, 4)
	if p.Dirty() != 3 {
		t.Fatalf("Dirty = %d, want 3", p.Dirty())
	}
	s.reset()
	if err := p.FlushAll(); err != nil {
		t.Fatal(err)
	}
	if got := s.countPrefix("write "); got != 3 || p.Dirty() != 0 {
		t.Fatalf("FlushAll wrote %d pages and left %d dirty; want 3 and 0", got, p.Dirty())
	}
	if err := p.FlushAll(); err != nil || s.countPrefix("write ") != 3 {
		t.Fatalf("a second FlushAll must write nothing: %v %v", err, s.events)
	}
	got := make([]byte, pager.PageSize)
	s.Pager.ReadPage(2, got)
	if got[1] != 0xEE {
		t.Fatal("FlushAll did not reach the file")
	}
}

func TestWritePageDoesNotReadAndNeedsNoFile(t *testing.T) {
	s := newSpy(t, 1)
	p := New(s, 4)
	s.reset()
	if err := p.WritePage(50, pageOf(0x42)); err != nil {
		t.Fatalf("WritePage of a page past the end of the file: %v", err)
	}
	if s.countPrefix("read ") != 0 {
		t.Fatalf("events %v: a page that is about to be overwritten must not be read", s.events)
	}
	got := make([]byte, pager.PageSize)
	if err := p.ReadPage(50, got); err != nil || got[0] != 0x42 {
		t.Fatalf("ReadPage back: %v, first byte %#x", err, got[0])
	}
	if s.countPrefix("read ") != 0 {
		t.Fatal("reading a page the pool holds went to the file")
	}
	if err := p.FlushAll(); err != nil {
		t.Fatal(err)
	}
	if err := s.Pager.ReadPage(50, got); err != nil || got[0] != 0x42 {
		t.Fatalf("page 50 on disk after FlushAll: %v, first byte %#x", err, got[0])
	}
}

func TestPoolIsAPageStore(t *testing.T) {
	s := newSpy(t, 0)
	p := New(s, 4)
	a, err := p.Allocate()
	if err != nil || a != 1 {
		t.Fatalf("Allocate = %d, %v", a, err)
	}
	p.WritePage(a, pageOf(5))
	p.SetRoot(a)
	if p.Root() != a || p.Meta().PageCount != 2 {
		t.Fatalf("meta = %+v root %d", p.Meta(), p.Root())
	}
	got := make([]byte, pager.PageSize)
	if err := p.ReadPage(a, got); err != nil || got[0] != 5 {
		t.Fatalf("ReadPage: %v %d", err, got[0])
	}
}

func TestAllocateSeesAFreePageStillInTheCache(t *testing.T) {
	s := newSpy(t, 0)
	p := New(s, 8)
	a, _ := p.Allocate()
	b, _ := p.Allocate()
	p.WritePage(a, pageOf(1))
	p.WritePage(b, pageOf(2))
	p.FlushAll()

	// Free page b the way the engine does: write a free-page image through
	// the pool and point the freelist at it. The image is dirty in the cache;
	// the file still holds the old bytes.
	img := make([]byte, pager.PageSize)
	pager.EncodeFreePage(img, 0)
	p.WritePage(b, img)
	m := p.Meta()
	m.FreeHead = b
	p.SetMeta(m)

	got, err := p.Allocate()
	if err != nil || got != b {
		t.Fatalf("Allocate = %d, %v; want the freed page %d", got, err, b)
	}
	if p.Meta().FreeHead != 0 {
		t.Fatalf("FreeHead = %d after popping the only free page", p.Meta().FreeHead)
	}
}

func TestSmallPoolOverManyPages(t *testing.T) {
	s := newSpy(t, 40)
	p := New(s, 5)
	rng := rand.New(rand.NewSource(3))
	for i := 0; i < 2000; i++ {
		no := pager.PageNo(1 + rng.Intn(40))
		f, err := p.Fetch(no)
		if err != nil {
			t.Fatal(err)
		}
		if f.Data[0] != byte(no) && f.Data[0] != byte(no)+100 {
			t.Fatalf("page %d holds %d: a frame was reused while pinned, or loaded the wrong page", no, f.Data[0])
		}
		if i%3 == 0 {
			for j := 0; j < pager.Usable; j++ {
				f.Data[j] = byte(no) + 100
			}
			p.Unpin(f, true)
		} else {
			p.Unpin(f, false)
		}
	}
	p.FlushAll()
	if p.Resident() > 5 {
		t.Fatalf("Resident = %d in a 5-frame pool", p.Resident())
	}
}

func TestConcurrentReaders(t *testing.T) {
	s := newSpy(t, 20)
	p := New(s, 8)
	var wg sync.WaitGroup
	for g := 0; g < 4; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(int64(g)))
			buf := make([]byte, pager.PageSize)
			for i := 0; i < 300; i++ {
				no := pager.PageNo(1 + rng.Intn(20))
				if err := p.ReadPage(no, buf); err != nil {
					t.Errorf("ReadPage(%d): %v", no, err)
					return
				}
				if !bytes.Equal(buf[:pager.Usable], pageOf(byte(no))[:pager.Usable]) {
					t.Errorf("page %d came back with the wrong bytes", no)
					return
				}
			}
		}(g)
	}
	wg.Wait()
}
