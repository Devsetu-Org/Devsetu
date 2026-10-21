package btree

import (
	"bytes"
	"fmt"

	"github.com/devlabs/btreekv/internal/pager"
)

// Stats describes the shape of a tree.
type Stats struct {
	Height   int // levels, 0 for an empty tree, 1 for a lone leaf
	Leaves   int
	Internal int
	Keys     int
}

// Check walks the whole tree and verifies its invariants: keys sorted and
// within the bounds their parents promise, every leaf at the same depth, no
// page reachable twice, no empty page except a lone root, and the leaf chain
// visiting every leaf once, in order. It is slow: for tests and the REPL.
func (t *Tree) Check() (Stats, error) {
	var st Stats
	root := t.io.Root()
	if root == 0 {
		return st, nil
	}
	c := &checker{t: t, seen: map[pager.PageNo]bool{}}
	h, err := c.walk(root, nil, nil, true, 0)
	if err != nil {
		return st, err
	}
	for i, no := range c.leaves {
		want := pager.PageNo(0)
		if i+1 < len(c.leaves) {
			want = c.leaves[i+1]
		}
		if c.nexts[i] != want {
			return st, fmt.Errorf("btree check: leaf %d links to %d, want %d", no, c.nexts[i], want)
		}
	}
	return Stats{Height: h, Leaves: len(c.leaves), Internal: c.internal, Keys: c.keys}, nil
}

type checker struct {
	t        *Tree
	seen     map[pager.PageNo]bool
	leaves   []pager.PageNo
	nexts    []pager.PageNo
	internal int
	keys     int
}

// walk checks the subtree at no, whose keys must lie in [lo, hi) (nil means
// unbounded), and returns its height.
func (c *checker) walk(no pager.PageNo, lo, hi []byte, isRoot bool, depth int) (int, error) {
	if depth > maxDepth {
		return 0, fmt.Errorf("btree check: deeper than %d levels", maxDepth)
	}
	if no == 0 {
		return 0, fmt.Errorf("btree check: pointer to page 0")
	}
	if c.seen[no] {
		return 0, fmt.Errorf("btree check: page %d is reachable twice", no)
	}
	c.seen[no] = true
	n, err := c.t.load(no)
	if err != nil {
		return 0, err
	}
	if len(n.keys) == 0 && !(isRoot && n.leaf) {
		return 0, fmt.Errorf("btree check: page %d is empty", no)
	}
	for i, k := range n.keys {
		if i > 0 && bytes.Compare(n.keys[i-1], k) >= 0 {
			return 0, fmt.Errorf("btree check: page %d keys out of order at %d", no, i)
		}
		if lo != nil && bytes.Compare(k, lo) < 0 {
			return 0, fmt.Errorf("btree check: page %d key %q below its lower bound %q", no, k, lo)
		}
		if hi != nil && bytes.Compare(k, hi) >= 0 {
			return 0, fmt.Errorf("btree check: page %d key %q not below its upper bound %q", no, k, hi)
		}
	}
	if n.leaf {
		c.leaves = append(c.leaves, no)
		c.nexts = append(c.nexts, n.next)
		c.keys += len(n.keys)
		return 1, nil
	}
	c.internal++
	height := 0
	for i, child := range n.children {
		clo, chi := lo, hi
		if i > 0 {
			clo = n.keys[i-1]
		}
		if i < len(n.keys) {
			chi = n.keys[i]
		}
		h, err := c.walk(child, clo, chi, false, depth+1)
		if err != nil {
			return 0, err
		}
		if i == 0 {
			height = h
		} else if h != height {
			return 0, fmt.Errorf("btree check: page %d has children of different heights", no)
		}
	}
	return height + 1, nil
}
