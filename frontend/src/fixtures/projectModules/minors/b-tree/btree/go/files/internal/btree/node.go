package btree

import (
	"encoding/binary"
	"fmt"
	"slices"

	"github.com/devlabs/btreekv/internal/pager"
)

// Limits. They keep every node at least a few entries wide, so a page that
// overflows can always be cut into two pages that fit.
const (
	MaxKeySize   = 128
	MaxValueSize = 1024
)

const (
	typeLeaf     byte = 1
	typeInternal byte = 2

	// headerSize is the fixed start of a node page:
	//   [0] type  [1] unused  [2:4] key count  [4:8] next (leaf) or last child (internal)
	headerSize = 8
	// capacity is how many bytes of cells fit after the header.
	capacity = pager.Usable - headerSize
)

// node is a decoded page.
//
// A leaf holds keys[i] -> vals[i] in key order and links to its right
// sibling. An internal node holds separator keys and len(keys)+1 children:
// children[i] covers keys below keys[i], children[i+1] covers keys at or above
// it.
//
// On disk, a leaf cell is keyLen(2) valLen(2) key value. An internal cell is
// keyLen(2) key child(4), the child to the left of that key, and the last
// child lives in the header.
type node struct {
	leaf     bool
	keys     [][]byte
	vals     [][]byte       // leaf only
	children []pager.PageNo // internal only
	next     pager.PageNo   // leaf only: right sibling, 0 for none
}

// cellSize is the encoded size of entry i.
func (n *node) cellSize(i int) int {
	if n.leaf {
		return 4 + len(n.keys[i]) + len(n.vals[i])
	}
	return 2 + len(n.keys[i]) + 4
}

// size is the encoded size of all cells.
func (n *node) size() int {
	total := 0
	for i := range n.keys {
		total += n.cellSize(i)
	}
	return total
}

// fits reports whether the node can be written as one page.
func (n *node) fits() bool { return n.size() <= capacity }

// splitPoint says where to cut an overfull node so both halves are about
// equal in bytes. For a leaf it is the index of the first key of the right
// node. For an internal node it is the index of the key that moves up to the
// parent: it ends up in neither half.
func (n *node) splitPoint() int {
	total := n.size()
	acc := 0
	for i := range n.keys {
		c := n.cellSize(i)
		if n.leaf {
			acc += c
			if acc >= total/2 {
				return min(max(i+1, 1), len(n.keys)-1)
			}
			continue
		}
		if acc+c >= total/2 {
			return min(max(i, 1), len(n.keys)-2)
		}
		acc += c
	}
	return len(n.keys) / 2
}

// insertChild adds separator sep and the page to its right to an internal
// node, after child i (the child that just split).
func (n *node) insertChild(i int, sep []byte, right pager.PageNo) {
	n.keys = slices.Insert(n.keys, i, sep)
	n.children = slices.Insert(n.children, i+1, right)
}

// encode writes the node into buf, a PageSize page. It panics if the node does
// not fit: the tree must split before it writes.
func (n *node) encode(buf []byte) {
	if !n.fits() {
		panic(fmt.Sprintf("btree: node of %d bytes does not fit in a page (%d)", n.size(), capacity))
	}
	clear(buf)
	if n.leaf {
		buf[0] = typeLeaf
		binary.LittleEndian.PutUint32(buf[4:], uint32(n.next))
	} else {
		buf[0] = typeInternal
		binary.LittleEndian.PutUint32(buf[4:], uint32(n.children[len(n.children)-1]))
	}
	binary.LittleEndian.PutUint16(buf[2:], uint16(len(n.keys)))
	off := headerSize
	for i, k := range n.keys {
		binary.LittleEndian.PutUint16(buf[off:], uint16(len(k)))
		off += 2
		if n.leaf {
			binary.LittleEndian.PutUint16(buf[off:], uint16(len(n.vals[i])))
			off += 2
		}
		off += copy(buf[off:], k)
		if n.leaf {
			off += copy(buf[off:], n.vals[i])
		} else {
			binary.LittleEndian.PutUint32(buf[off:], uint32(n.children[i]))
			off += 4
		}
	}
}

// decode parses a page. Keys and values are copied out of buf.
func decode(buf []byte) (*node, error) {
	n := &node{}
	switch buf[0] {
	case typeLeaf:
		n.leaf = true
		n.next = pager.PageNo(binary.LittleEndian.Uint32(buf[4:]))
	case typeInternal:
	default:
		return nil, fmt.Errorf("%w: page type %#x", ErrCorrupt, buf[0])
	}
	count := int(binary.LittleEndian.Uint16(buf[2:]))
	off := headerSize
	need := func(k int) error {
		if off+k > pager.Usable {
			return fmt.Errorf("%w: cell runs past the end of the page", ErrCorrupt)
		}
		return nil
	}
	for i := 0; i < count; i++ {
		if err := need(2); err != nil {
			return nil, err
		}
		kl := int(binary.LittleEndian.Uint16(buf[off:]))
		off += 2
		vl := 0
		if n.leaf {
			if err := need(2); err != nil {
				return nil, err
			}
			vl = int(binary.LittleEndian.Uint16(buf[off:]))
			off += 2
		}
		if err := need(kl + vl); err != nil {
			return nil, err
		}
		n.keys = append(n.keys, slices.Clone(buf[off:off+kl]))
		off += kl
		if n.leaf {
			n.vals = append(n.vals, slices.Clone(buf[off:off+vl]))
			off += vl
			continue
		}
		if err := need(4); err != nil {
			return nil, err
		}
		n.children = append(n.children, pager.PageNo(binary.LittleEndian.Uint32(buf[off:])))
		off += 4
	}
	if !n.leaf {
		n.children = append(n.children, pager.PageNo(binary.LittleEndian.Uint32(buf[4:])))
	}
	return n, nil
}
