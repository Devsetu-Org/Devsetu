package btree

import "slices"

// underfull reports whether a non-root node has dropped below a quarter of a
// page. It is time to borrow from a sibling or merge with it.
func (n *node) underfull() bool { return n.size() < capacity/4 }

// removeLeafAt deletes entry i from leaf n.
func (n *node) removeLeafAt(i int) {
	n.keys = slices.Delete(n.keys, i, i+1)
	n.vals = slices.Delete(n.vals, i, i+1)
}

// removeChild deletes separator i and the child to its right from internal
// node n: the right half of a merged pair is gone.
func (n *node) removeChild(i int) {
	n.keys = slices.Delete(n.keys, i, i+1)
	n.children = slices.Delete(n.children, i+1, i+2)
}

// canMerge reports whether two adjacent siblings, which the parent separates
// with sep, fit in one page together. An internal merge also pulls sep down.
func canMerge(left, right *node, sep []byte) bool {
	total := left.size() + right.size()
	if !left.leaf {
		total += 2 + len(sep) + 4
	}
	return total <= capacity
}

// mergeNodes appends right to left. A leaf also takes over right's sibling
// link; an internal node pulls the parent's separator down between the two key
// lists. The caller frees right's page and removes it from the parent.
func mergeNodes(left, right *node, sep []byte) {
	if left.leaf {
		left.keys = append(left.keys, right.keys...)
		left.vals = append(left.vals, right.vals...)
		left.next = right.next
		return
	}
	left.keys = append(left.keys, sep)
	left.keys = append(left.keys, right.keys...)
	left.children = append(left.children, right.children...)
}

// redistribute pools two siblings that cannot merge and cuts them again about
// evenly, which moves entries from the fuller one to the emptier one (a
// borrow). It returns the new separator for the parent: for leaves a copy of
// the right node's first key, for internal nodes the key that moves up.
// Neither node's page number changes, so a leaf keeps its sibling link.
func redistribute(left, right *node, sep []byte) []byte {
	next := left.next
	mergeNodes(left, right, sep)
	rn, newSep := left.split()
	left.next = next
	*right = *rn
	return newSep
}
