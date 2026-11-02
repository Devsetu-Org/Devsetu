package index

import (
	"os"
	"path/filepath"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
)

// StatusBuckets are the three status lists.
type StatusBuckets struct {
	Staged    []string
	Modified  []string
	Untracked []string
}

// Status compares HEAD tree, index, and worktree.
func Status(r *repo.Repo) (StatusBuckets, error) {
	// TODO(3.3): Load index. Build HEAD path→hash map via headFileMap (empty if no commit).
	// Staged: index vs HEAD. Modified: worktree blob hash vs index (HashOf(EncodeHeader(blob, data))).
	// Untracked: listUntracked. Sort each list. Import sort.
	panic("TODO(3.3): Status")
}

func unique(in []string) []string {
	if len(in) == 0 {
		return in
	}
	out := []string{in[0]}
	for i := 1; i < len(in); i++ {
		if in[i] != in[i-1] {
			out = append(out, in[i])
		}
	}
	return out
}

func headFileMap(r *repo.Repo) (map[string]object.Hash, error) {
	out := map[string]object.Hash{}
	h, err := ref.ResolveHEAD(r)
	if err != nil {
		return out, nil
	}
	if h.IsZero() {
		return out, nil
	}
	c, err := object.GetCommit(r.Objects(), h)
	if err != nil {
		return nil, err
	}
	return flattenTree(r.Objects(), c.Tree, "")
}

func flattenTree(s *object.Store, tree object.Hash, prefix string) (map[string]object.Hash, error) {
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
			sub, err := flattenTree(s, e.Hash, path)
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

func listUntracked(root string, inIndex map[string]Entry) ([]string, error) {
	var out []string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if rel == "." {
			return nil
		}
		if info.IsDir() {
			if info.Name() == ".tinygit" || info.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if _, ok := inIndex[rel]; ok {
			return nil
		}
		out = append(out, rel)
		return nil
	})
	return out, err
}
