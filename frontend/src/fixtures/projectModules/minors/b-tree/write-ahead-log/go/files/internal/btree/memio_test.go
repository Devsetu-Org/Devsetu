package btree

import (
	"fmt"

	"github.com/devlabs/btreekv/internal/pager"
)

// memIO is an in-memory PageIO. It counts reads, and it is strict: reading or
// writing a page that is not allocated, or freeing one twice, is an error, so
// a tree that uses a page after freeing it fails loudly.
type memIO struct {
	pages  map[pager.PageNo][]byte
	next   pager.PageNo
	free   []pager.PageNo
	root   pager.PageNo
	reads  int
	writes int
}

func newMemIO() *memIO {
	return &memIO{pages: map[pager.PageNo][]byte{}, next: 1}
}

func (m *memIO) ReadPage(no pager.PageNo, buf []byte) error {
	p, ok := m.pages[no]
	if !ok {
		return fmt.Errorf("memIO: read of page %d, which is not allocated", no)
	}
	m.reads++
	copy(buf, p)
	return nil
}

func (m *memIO) WritePage(no pager.PageNo, buf []byte) error {
	if _, ok := m.pages[no]; !ok {
		return fmt.Errorf("memIO: write to page %d, which is not allocated", no)
	}
	m.writes++
	m.pages[no] = append([]byte(nil), buf...)
	return nil
}

func (m *memIO) Allocate() (pager.PageNo, error) {
	var no pager.PageNo
	if n := len(m.free); n > 0 {
		no, m.free = m.free[n-1], m.free[:n-1]
	} else {
		no = m.next
		m.next++
	}
	m.pages[no] = make([]byte, pager.PageSize)
	return no, nil
}

func (m *memIO) Free(no pager.PageNo) error {
	if _, ok := m.pages[no]; !ok {
		return fmt.Errorf("memIO: free of page %d, which is not allocated (freed twice?)", no)
	}
	delete(m.pages, no)
	m.free = append(m.free, no)
	return nil
}

func (m *memIO) Root() pager.PageNo      { return m.root }
func (m *memIO) SetRoot(no pager.PageNo) { m.root = no }

// live is the number of allocated pages.
func (m *memIO) live() int { return len(m.pages) }
