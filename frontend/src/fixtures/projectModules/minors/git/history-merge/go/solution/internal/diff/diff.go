package diff

import (
	"sort"

	"github.com/devlabs/tinygit/internal/object"
)

// Change is one path that differs between two trees.
type Change struct {
	Path   string
	Old    object.Hash // zero if added
	New    object.Hash // zero if deleted
	Status string      // "A", "M", "D"
}

// TreeDiff compares two trees (by hash) into a sorted change list.
func TreeDiff(s *object.Store, a, b object.Hash) ([]Change, error) {
	left, err := flatten(s, a, "")
	if err != nil {
		return nil, err
	}
	right, err := flatten(s, b, "")
	if err != nil {
		return nil, err
	}
	paths := map[string]struct{}{}
	for p := range left {
		paths[p] = struct{}{}
	}
	for p := range right {
		paths[p] = struct{}{}
	}
	var names []string
	for p := range paths {
		names = append(names, p)
	}
	sort.Strings(names)
	var out []Change
	for _, p := range names {
		oh, ook := left[p]
		nh, nok := right[p]
		switch {
		case ook && !nok:
			out = append(out, Change{Path: p, Old: oh, Status: "D"})
		case !ook && nok:
			out = append(out, Change{Path: p, New: nh, Status: "A"})
		case oh != nh:
			out = append(out, Change{Path: p, Old: oh, New: nh, Status: "M"})
		}
	}
	return out, nil
}

func flatten(s *object.Store, tree object.Hash, prefix string) (map[string]object.Hash, error) {
	if tree.IsZero() {
		return map[string]object.Hash{}, nil
	}
	entries, err := object.GetTree(s, tree)
	if err != nil {
		return nil, err
	}
	out := map[string]object.Hash{}
	for _, e := range entries {
		path := e.Name
		if prefix != "" {
			path = prefix + "/" + e.Name
		}
		switch e.Mode {
		case object.ModeTree:
			sub, err := flatten(s, e.Hash, path)
			if err != nil {
				return nil, err
			}
			for k, v := range sub {
				out[k] = v
			}
		case object.ModeFile:
			out[path] = e.Hash
		}
	}
	return out, nil
}
