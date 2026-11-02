package merge

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

const (
	MarkerOurs   = "<<<<<<<"
	MarkerSep    = "======="
	MarkerTheirs = ">>>>>>>"
)

// Result describes a merge outcome.
type Result struct {
	Commit      object.Hash
	Conflicts   []string
	FastForward bool
}

// Merge merges theirBranch into the current HEAD.
func Merge(r *repo.Repo, theirBranch string) (Result, error) {
	// TODO(5.4): Resolve ours/theirs, MergeBase.
	// If base == theirs: already up to date. If base == ours: fast-forward checkout.
	// Else three-way on flattened trees; writeConflict on both-changed paths using the markers.
	// On clean merge: WriteTree, PutCommit with two parents, UpdateRef HEAD.
	panic("TODO(5.4): Merge")
}

func writeBlobFile(r *repo.Repo, path string, h object.Hash) error {
	data, err := object.GetBlob(r.Objects(), h)
	if err != nil {
		return err
	}
	abs := filepath.Join(r.Root, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, data, 0o644)
}

func writeConflict(r *repo.Repo, path string, ours, theirs object.Hash) error {
	var ob, tb []byte
	var err error
	if !ours.IsZero() {
		ob, err = object.GetBlob(r.Objects(), ours)
		if err != nil {
			return err
		}
	}
	if !theirs.IsZero() {
		tb, err = object.GetBlob(r.Objects(), theirs)
		if err != nil {
			return err
		}
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%s ours\n", MarkerOurs)
	b.Write(ob)
	if len(ob) > 0 && ob[len(ob)-1] != '\n' {
		b.WriteByte('\n')
	}
	fmt.Fprintf(&b, "%s\n", MarkerSep)
	b.Write(tb)
	if len(tb) > 0 && tb[len(tb)-1] != '\n' {
		b.WriteByte('\n')
	}
	fmt.Fprintf(&b, "%s theirs\n", MarkerTheirs)
	abs := filepath.Join(r.Root, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(b.String()), 0o644)
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
