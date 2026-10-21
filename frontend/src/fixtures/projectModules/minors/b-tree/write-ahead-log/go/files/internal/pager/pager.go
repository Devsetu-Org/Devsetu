package pager

import (
	"fmt"
	"os"
	"sync"
)

// Pager is one page file. ReadPage and WritePage are safe to call from many
// goroutines; Allocate and Free serialize on the header state.
type Pager struct {
	f    *os.File
	mu   sync.Mutex // guards meta
	meta Meta
}

// Open opens the page file at path, creating it (with an empty header) when
// it does not exist.
func Open(path string) (*Pager, error) {
	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	p := &Pager{f: f}
	if st.Size() == 0 {
		p.meta = Meta{PageCount: 1}
		if err := p.Sync(); err != nil {
			f.Close()
			return nil, err
		}
		return p, nil
	}
	buf := make([]byte, PageSize)
	if err := p.ReadPage(0, buf); err != nil {
		f.Close()
		return nil, fmt.Errorf("pager: read header: %w", err)
	}
	if p.meta, err = decodeHeader(buf); err != nil {
		f.Close()
		return nil, err
	}
	return p, nil
}

// Meta returns the header state as it is in memory right now.
func (p *Pager) Meta() Meta {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.meta
}

// SetMeta replaces the in-memory header state. It reaches the file on Sync.
func (p *Pager) SetMeta(m Meta) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.meta = m
}

// Root is the tree's root page, or 0 for an empty tree.
func (p *Pager) Root() PageNo { return p.Meta().Root }

// SetRoot records a new root page. It reaches the file on Sync.
func (p *Pager) SetRoot(no PageNo) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.meta.Root = no
}

// Sync writes the header page and fsyncs the file.
func (p *Pager) Sync() error {
	buf := make([]byte, PageSize)
	encodeHeader(buf, p.Meta())
	if err := p.WritePage(0, buf); err != nil {
		return err
	}
	return p.f.Sync()
}

// Close syncs and closes the file.
func (p *Pager) Close() error {
	if err := p.Sync(); err != nil {
		p.f.Close()
		return err
	}
	return p.f.Close()
}
