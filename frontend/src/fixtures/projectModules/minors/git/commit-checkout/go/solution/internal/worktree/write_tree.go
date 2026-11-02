package worktree

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// WriteTree builds a nested tree from the index and returns the root tree hash.
func WriteTree(r *repo.Repo) (object.Hash, error) {
	idx, err := index.Load(r.IndexPath())
	if err != nil {
		return object.Zero, err
	}
	if len(idx.Entries) == 0 {
		return object.PutTree(r.Objects(), nil)
	}
	root := map[string]any{} // name -> Entry or nested map
	for _, e := range idx.Entries {
		parts := strings.Split(e.Path, "/")
		cur := root
		for i, part := range parts {
			if i == len(parts)-1 {
				cur[part] = e
				continue
			}
			next, ok := cur[part]
			if !ok {
				m := map[string]any{}
				cur[part] = m
				cur = m
				continue
			}
			m, ok := next.(map[string]any)
			if !ok {
				return object.Zero, fmt.Errorf("worktree: path conflict at %s", path.Join(parts[:i+1]...))
			}
			cur = m
		}
	}
	return writeNode(r.Objects(), root)
}

func writeNode(s *object.Store, node map[string]any) (object.Hash, error) {
	names := make([]string, 0, len(node))
	for n := range node {
		names = append(names, n)
	}
	sort.Strings(names)
	var entries []object.TreeEntry
	for _, name := range names {
		switch v := node[name].(type) {
		case index.Entry:
			entries = append(entries, object.TreeEntry{Mode: v.Mode, Name: name, Hash: v.Hash})
		case map[string]any:
			h, err := writeNode(s, v)
			if err != nil {
				return object.Zero, err
			}
			entries = append(entries, object.TreeEntry{Mode: object.ModeTree, Name: name, Hash: h})
		default:
			return object.Zero, fmt.Errorf("worktree: bad node type")
		}
	}
	return object.PutTree(s, entries)
}
