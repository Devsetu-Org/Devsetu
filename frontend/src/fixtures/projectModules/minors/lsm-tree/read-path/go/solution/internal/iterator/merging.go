// Package iterator merges sorted sources into one sorted stream.
package iterator

import (
	"bytes"
	"container/heap"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// Iterator is what the memtable and SSTable iterators have in common.
type Iterator interface {
	SeekToFirst()
	Seek(target []byte)
	Valid() bool
	Next()
	Key() []byte
	Value() []byte
	Kind() memtable.Kind
}

// Merging walks several sorted iterators as one, in key order.
//
// children[0] is the newest source. When more than one child holds a key, only
// the newest child's entry is returned; the older ones are skipped. Tombstones
// are returned like any other entry: deciding what they mean is the caller's
// job.
type Merging struct {
	children []Iterator
	h        mergeHeap
}

// NewMerging merges children, newest first.
func NewMerging(children ...Iterator) *Merging {
	return &Merging{children: children}
}

type item struct {
	it   Iterator
	rank int // position in children: lower is newer
}

// mergeHeap is a min-heap of the children that still have entries, ordered so
// the entry Merging should return next is always at index 0.
type mergeHeap []item

func (h mergeHeap) Len() int { return len(h) }

func (h mergeHeap) Less(i, j int) bool {
	if c := bytes.Compare(h[i].it.Key(), h[j].it.Key()); c != 0 {
		return c < 0
	}
	return h[i].rank < h[j].rank
}

func (h mergeHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *mergeHeap) Push(x any)   { *h = append(*h, x.(item)) }
func (h *mergeHeap) Pop() any {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

// SeekToFirst positions on the smallest key across all children.
func (m *Merging) SeekToFirst() {
	for _, c := range m.children {
		c.SeekToFirst()
	}
	m.rebuild()
}

// Seek positions on the first key >= target across all children.
func (m *Merging) Seek(target []byte) {
	for _, c := range m.children {
		c.Seek(target)
	}
	m.rebuild()
}

func (m *Merging) rebuild() {
	m.h = m.h[:0]
	for i, c := range m.children {
		if c.Valid() {
			m.h = append(m.h, item{it: c, rank: i})
		}
	}
	heap.Init(&m.h)
}

// Valid reports whether the iterator is positioned on an entry.
func (m *Merging) Valid() bool { return len(m.h) > 0 }

// Key of the current entry. Only call when Valid.
func (m *Merging) Key() []byte { return m.h[0].it.Key() }

// Value of the current entry. Only call when Valid.
func (m *Merging) Value() []byte { return m.h[0].it.Value() }

// Kind of the current entry. Only call when Valid.
func (m *Merging) Kind() memtable.Kind { return m.h[0].it.Kind() }

// Next moves past the current key in every child that holds it. Only call
// when Valid.
func (m *Merging) Next() {
	key := append([]byte(nil), m.h[0].it.Key()...)
	for len(m.h) > 0 && bytes.Equal(m.h[0].it.Key(), key) {
		top := m.h[0].it
		top.Next()
		if top.Valid() {
			heap.Fix(&m.h, 0)
		} else {
			heap.Pop(&m.h)
		}
	}
}
