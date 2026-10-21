package db

import (
	"fmt"
	"sort"

	"github.com/devlabs/btreekv/internal/btree"
	"github.com/devlabs/btreekv/internal/pager"
	"github.com/devlabs/btreekv/internal/wal"
)

// store is the page layer the DB sits on: the pager in chapter 3, the buffer
// pool in chapter 4. Meta and SetMeta expose the header state the log must
// capture.
type store interface {
	btree.PageIO
	Meta() pager.Meta
	SetMeta(pager.Meta)
}

// txn is one write in flight. The tree runs over it as its PageIO: reads fall
// through to the store, but every write lands in memory only. Nothing reaches
// a page of the file until the log holds the whole change. That is what makes
// "log first" possible even though the tree calls WritePage as it goes.
type txn struct {
	base  store
	start pager.Meta
	pages map[pager.PageNo][]byte
	freed []pager.PageNo
	root  pager.PageNo
}

func newTxn(base store) *txn {
	m := base.Meta()
	return &txn{base: base, start: m, pages: map[pager.PageNo][]byte{}, root: m.Root}
}

var _ btree.PageIO = (*txn)(nil)

func (t *txn) ReadPage(no pager.PageNo, buf []byte) error {
	if p, ok := t.pages[no]; ok {
		copy(buf, p)
		return nil
	}
	for _, f := range t.freed {
		if f == no {
			return fmt.Errorf("db: read of page %d after it was freed", no)
		}
	}
	return t.base.ReadPage(no, buf)
}

func (t *txn) WritePage(no pager.PageNo, buf []byte) error {
	if len(buf) != pager.PageSize {
		return fmt.Errorf("db: write of a %d-byte buffer", len(buf))
	}
	t.pages[no] = append([]byte(nil), buf...)
	return nil
}

// Allocate takes a page number from the store. This changes no page on disk:
// it pops the freelist in memory or appends a blank page past the end.
func (t *txn) Allocate() (pager.PageNo, error) { return t.base.Allocate() }

// Free defers: the page joins the freelist when the txn is turned into log
// records, so the free page's link goes through the log like everything else.
func (t *txn) Free(no pager.PageNo) error {
	delete(t.pages, no)
	t.freed = append(t.freed, no)
	return nil
}

func (t *txn) Root() pager.PageNo      { return t.root }
func (t *txn) SetRoot(no pager.PageNo) { t.root = no }

// dirty reports whether the txn changed anything.
func (t *txn) dirty() bool {
	return len(t.pages) > 0 || len(t.freed) > 0 || t.root != t.start.Root
}

// abort puts the store's header state back as it was when the txn began.
func (t *txn) abort() { t.base.SetMeta(t.start) }

// records turns the txn into one log batch: an after-image for every page it
// wrote, the header state it leaves behind, and a commit record. Call it once.
func (t *txn) records() []wal.Record {
	meta := t.base.Meta()
	meta.Root = t.root
	for _, no := range t.freed {
		img := make([]byte, pager.PageSize)
		pager.EncodeFreePage(img, meta.FreeHead)
		t.pages[no] = img
		meta.FreeHead = no
	}
	nos := make([]pager.PageNo, 0, len(t.pages))
	for no := range t.pages {
		nos = append(nos, no)
	}
	sort.Slice(nos, func(i, j int) bool { return nos[i] < nos[j] })

	recs := make([]wal.Record, 0, len(nos)+2)
	for _, no := range nos {
		recs = append(recs, wal.Record{Kind: wal.KindPage, Page: uint32(no), Data: t.pages[no][:pager.Usable]})
	}
	recs = append(recs, wal.MetaRecord(uint32(meta.Root), uint32(meta.PageCount), uint32(meta.FreeHead)))
	return append(recs, wal.CommitRecord())
}
