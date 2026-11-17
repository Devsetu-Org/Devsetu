package index

import (
	"os"
	"path/filepath"
	"sort"

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
	idx, err := Load(r.IndexPath())
	if err != nil {
		return StatusBuckets{}, err
	}
	headFiles, err := headFileMap(r)
	if err != nil {
		return StatusBuckets{}, err
	}

	var staged, modified []string
	inIndex := map[string]Entry{}
	for _, e := range idx.Entries {
		inIndex[e.Path] = e
		hh, ok := headFiles[e.Path]
		if !ok || hh != e.Hash {
			staged = append(staged, e.Path)
		}
		abs := filepath.Join(r.Root, filepath.FromSlash(e.Path))
		data, err := os.ReadFile(abs)
		if err != nil {
			if os.IsNotExist(err) {
				modified = append(modified, e.Path)
				continue
			}
			return StatusBuckets{}, err
		}
		raw := object.EncodeHeader(object.TypeBlob, data)
		if object.HashOf(raw) != e.Hash {
			modified = append(modified, e.Path)
		}
	}
	for path := range headFiles {
		if _, ok := inIndex[path]; !ok {
			staged = append(staged, path)
		}
	}

	untracked, err := listUntracked(r.Root, inIndex)
	if err != nil {
		return StatusBuckets{}, err
	}
	sort.Strings(staged)
	sort.Strings(modified)
	sort.Strings(untracked)
	return StatusBuckets{Staged: unique(staged), Modified: unique(modified), Untracked: untracked}, nil
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
		if os.IsNotExist(err) {
			return out, nil
		}
		return out, nil // no commits yet
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
