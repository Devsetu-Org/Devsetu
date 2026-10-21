package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// delete removes key from the subtree at page no. It reports whether the key
// was there, and whether page no is now underfull, so its parent can fix it.
func (t *Tree) delete(no pager.PageNo, key []byte) (found, under bool, err error) {
	n, err := t.load(no)
	if err != nil {
		return false, false, err
	}
	if n.leaf {
		i, ok := n.leafIndex(key)
		if !ok {
			return false, false, nil
		}
		n.removeLeafAt(i)
		if err := t.store(no, n); err != nil {
			return false, false, err
		}
		return true, n.underfull(), nil
	}
	i := n.childIndex(key)
	found, childUnder, err := t.delete(n.children[i], key)
	if err != nil || !found || !childUnder {
		return found, false, err
	}
	if err := t.rebalance(no, n, i); err != nil {
		return false, false, err
	}
	return true, n.underfull(), nil
}

// rebalance repairs child i of internal node parent (stored at parentNo),
// which has just become underfull, using a sibling: it merges the two pages
// when they fit in one, and otherwise borrows from the fuller one. It rewrites
// every page it changed, parent included.
func (t *Tree) rebalance(parentNo pager.PageNo, parent *node, i int) error {
	li := i
	if i > 0 {
		li = i - 1
	}
	leftNo, rightNo := parent.children[li], parent.children[li+1]
	sep := parent.keys[li]
	left, err := t.load(leftNo)
	if err != nil {
		return err
	}
	right, err := t.load(rightNo)
	if err != nil {
		return err
	}
	if canMerge(left, right, sep) {
		mergeNodes(left, right, sep)
		if err := t.store(leftNo, left); err != nil {
			return err
		}
		if err := t.io.Free(rightNo); err != nil {
			return err
		}
		parent.removeChild(li)
	} else {
		parent.keys[li] = redistribute(left, right, sep)
		if err := t.store(leftNo, left); err != nil {
			return err
		}
		if err := t.store(rightNo, right); err != nil {
			return err
		}
	}
	return t.store(parentNo, parent)
}

// Delete removes key and reports whether it was there.
func (t *Tree) Delete(key []byte) (bool, error) {
	root := t.io.Root()
	if root == 0 || len(key) == 0 {
		return false, nil
	}
	found, _, err := t.delete(root, key)
	if err != nil || !found {
		return false, err
	}
	for root = t.io.Root(); root != 0; root = t.io.Root() {
		n, err := t.load(root)
		if err != nil {
			return true, err
		}
		switch {
		case n.leaf && len(n.keys) == 0:
			t.io.SetRoot(0)
		case !n.leaf && len(n.keys) == 0:
			t.io.SetRoot(n.children[0])
		default:
			return true, nil
		}
		if err := t.io.Free(root); err != nil {
			return true, err
		}
	}
	return true, nil
}
