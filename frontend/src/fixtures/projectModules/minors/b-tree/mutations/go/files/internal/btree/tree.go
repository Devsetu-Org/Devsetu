package btree

import (
	"errors"
	"fmt"

	"github.com/devlabs/btreekv/internal/pager"
)

var (
	// ErrEmptyKey is returned for a zero-length key.
	ErrEmptyKey = errors.New("btree: empty key")
	// ErrKeyTooLarge is returned for a key longer than MaxKeySize.
	ErrKeyTooLarge = errors.New("btree: key too large")
	// ErrValueTooLarge is returned for a value longer than MaxValueSize.
	ErrValueTooLarge = errors.New("btree: value too large")
	// ErrCorrupt means a page does not look like a tree node.
	ErrCorrupt = errors.New("btree: corrupt page")
)

// maxDepth stops a walk that follows a corrupt cycle of child pointers.
const maxDepth = 64

// Tree is a B+ tree over a PageIO. It is not safe for concurrent use; the
// layer above serializes writers.
type Tree struct {
	io PageIO
}

// New returns a tree over io. An empty tree has root 0.
func New(io PageIO) *Tree { return &Tree{io: io} }

// load reads and decodes page no.
func (t *Tree) load(no pager.PageNo) (*node, error) {
	buf := make([]byte, pager.PageSize)
	if err := t.io.ReadPage(no, buf); err != nil {
		return nil, fmt.Errorf("btree: read page %d: %w", no, err)
	}
	n, err := decode(buf)
	if err != nil {
		return nil, fmt.Errorf("btree: page %d: %w", no, err)
	}
	return n, nil
}

// store encodes n and writes it as page no.
func (t *Tree) store(no pager.PageNo, n *node) error {
	buf := make([]byte, pager.PageSize)
	n.encode(buf)
	return t.io.WritePage(no, buf)
}

// newPage allocates a page for n and writes it.
func (t *Tree) newPage(n *node) (pager.PageNo, error) {
	no, err := t.io.Allocate()
	if err != nil {
		return 0, err
	}
	return no, t.store(no, n)
}

// checkEntry validates a key and value before they go in the tree.
func checkEntry(key, val []byte) error {
	switch {
	case len(key) == 0:
		return ErrEmptyKey
	case len(key) > MaxKeySize:
		return fmt.Errorf("%w: %d bytes, max %d", ErrKeyTooLarge, len(key), MaxKeySize)
	case len(val) > MaxValueSize:
		return fmt.Errorf("%w: %d bytes, max %d", ErrValueTooLarge, len(val), MaxValueSize)
	}
	return nil
}

// promoted is what a split hands to the parent: the separator and the new
// page to its right.
type promoted struct {
	sep   []byte
	right pager.PageNo
}
