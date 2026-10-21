// Package btree is a B+ tree whose nodes are pages. It never touches a file:
// it reads and writes pages through a PageIO, so the same tree runs over the
// raw pager, a logging layer, or a buffer pool.
package btree

import "github.com/devlabs/btreekv/internal/pager"

// PageIO is everything the tree needs from the layer below it. *pager.Pager
// implements it; so do the transaction and buffer pool of later chapters.
type PageIO interface {
	// ReadPage fills buf (PageSize bytes) with page no.
	ReadPage(no pager.PageNo, buf []byte) error
	// WritePage writes buf (PageSize bytes) as page no.
	WritePage(no pager.PageNo, buf []byte) error
	// Allocate returns a page number nobody is using.
	Allocate() (pager.PageNo, error)
	// Free gives a page back for reuse.
	Free(no pager.PageNo) error
	// Root is the root page of the tree, or 0 for an empty tree.
	Root() pager.PageNo
	// SetRoot records a new root page.
	SetRoot(no pager.PageNo)
}

var _ PageIO = (*pager.Pager)(nil)
