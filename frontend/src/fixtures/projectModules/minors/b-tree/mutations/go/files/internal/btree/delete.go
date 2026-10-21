package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// delete removes key from the subtree at page no. It reports whether the key
// was there, and whether page no is now underfull, so its parent can fix it.
func (t *Tree) delete(no pager.PageNo, key []byte) (found, under bool, err error) {
	// TODO(5.1): n, err := t.load(no).
	// Leaf: i, ok := n.leafIndex(key). Absent: return false, false, nil without
	// writing anything. Present: n.removeLeafAt(i) (given), t.store(no, n), and
	// return true, n.underfull(), nil.
	// Internal: i := n.childIndex(key) and recurse into n.children[i]. If the
	// key was not found, or the child is not underfull, return as is (the
	// parent has not changed). Otherwise t.rebalance(no, n, i) (task 5.2) fixes
	// the child and rewrites n, and you return true, n.underfull(), nil.
	panic("TODO(5.1): delete")
}

// rebalance repairs child i of internal node parent (stored at parentNo),
// which has just become underfull, using a sibling: it merges the two pages
// when they fit in one, and otherwise borrows from the fuller one. It rewrites
// every page it changed, parent included.
func (t *Tree) rebalance(parentNo pager.PageNo, parent *node, i int) error {
	// TODO(5.2): Pair child i with its left sibling when it has one, otherwise with its
	// right sibling: li := i, or i-1 if i > 0. leftNo, rightNo are
	// parent.children[li] and [li+1]; sep is parent.keys[li]. Load both nodes.
	// If canMerge(left, right, sep): mergeNodes(left, right, sep), store left
	// at leftNo, t.io.Free(rightNo), and parent.removeChild(li).
	// Otherwise: parent.keys[li] = redistribute(left, right, sep) and store
	// both pages.
	// Either way finish by storing the parent at parentNo.
	panic("TODO(5.2): rebalance")
}

// Delete removes key and reports whether it was there.
func (t *Tree) Delete(key []byte) (bool, error) {
	// TODO(5.3): An empty tree (root 0) has nothing to delete. Otherwise found, _, err :=
	// t.delete(root, key); a miss or an error returns at once.
	// Then shrink the root, repeatedly while it applies: load it. A leaf with
	// no keys means the tree is empty: SetRoot(0) and Free the page. An
	// internal node with no keys has exactly one child: SetRoot(that child) and
	// Free the old root. That is the only way a B+ tree gets shorter.
	// Order matters: SetRoot before Free.
	panic("TODO(5.3): Delete")
}
