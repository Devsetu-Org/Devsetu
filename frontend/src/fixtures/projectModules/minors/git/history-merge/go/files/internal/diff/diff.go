package diff

import (
	"github.com/devlabs/tinygit/internal/object"
)

// Change is one path that differs between two trees.
type Change struct {
	Path   string
	Old    object.Hash
	New    object.Hash
	Status string // "A", "M", "D"
}

// TreeDiff compares two trees (by hash) into a sorted change list.
func TreeDiff(s *object.Store, a, b object.Hash) ([]Change, error) {
	// TODO(5.2): Flatten both trees to path→hash (use flatten). Emit A/M/D. Sort by Path.
	// Import sort.
	panic("TODO(5.2): TreeDiff")
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
