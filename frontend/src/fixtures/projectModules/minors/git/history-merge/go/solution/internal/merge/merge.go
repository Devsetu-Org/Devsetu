package merge

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
	"github.com/devlabs/tinygit/internal/worktree"
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
	ours, err := ref.ResolveHEAD(r)
	if err != nil {
		return Result{}, err
	}
	theirs, err := ref.Read(r, "refs/heads/"+theirBranch)
	if err != nil {
		return Result{}, err
	}
	base, err := MergeBase(r.Objects(), ours, theirs)
	if err != nil {
		return Result{}, err
	}
	if base == theirs {
		return Result{Commit: ours}, nil // already up to date
	}
	if base == ours {
		// fast-forward
		if err := worktree.Checkout(r, theirs); err != nil {
			return Result{}, err
		}
		hd, err := ref.ReadHEAD(r)
		if err != nil {
			return Result{}, err
		}
		if hd.Symbolic != "" {
			if err := ref.Write(r, hd.Symbolic, theirs); err != nil {
				return Result{}, err
			}
			if err := ref.WriteSymbolicHEAD(r, hd.Symbolic); err != nil {
				return Result{}, err
			}
		}
		return Result{Commit: theirs, FastForward: true}, nil
	}

	oc, err := object.GetCommit(r.Objects(), ours)
	if err != nil {
		return Result{}, err
	}
	tc, err := object.GetCommit(r.Objects(), theirs)
	if err != nil {
		return Result{}, err
	}
	bc, err := object.GetCommit(r.Objects(), base)
	if err != nil {
		return Result{}, err
	}
	obase, err := flatten(r.Objects(), bc.Tree, "")
	if err != nil {
		return Result{}, err
	}
	oours, err := flatten(r.Objects(), oc.Tree, "")
	if err != nil {
		return Result{}, err
	}
	otheirs, err := flatten(r.Objects(), tc.Tree, "")
	if err != nil {
		return Result{}, err
	}

	paths := map[string]struct{}{}
	for p := range obase {
		paths[p] = struct{}{}
	}
	for p := range oours {
		paths[p] = struct{}{}
	}
	for p := range otheirs {
		paths[p] = struct{}{}
	}
	var names []string
	for p := range paths {
		names = append(names, p)
	}
	sort.Strings(names)

	var conflicts []string
	var newIdx index.Index
	for _, p := range names {
		bh, bOK := obase[p]
		oh, oOK := oours[p]
		th, tOK := otheirs[p]
		switch {
		case oOK && tOK && oh == th:
			newIdx.Set(index.Entry{Path: p, Mode: object.ModeFile, Hash: oh})
			if err := writeBlobFile(r, p, oh); err != nil {
				return Result{}, err
			}
		case !bOK && oOK && !tOK:
			// added on ours only
			newIdx.Set(index.Entry{Path: p, Mode: object.ModeFile, Hash: oh})
			if err := writeBlobFile(r, p, oh); err != nil {
				return Result{}, err
			}
		case !bOK && tOK && !oOK:
			// added on theirs only
			newIdx.Set(index.Entry{Path: p, Mode: object.ModeFile, Hash: th})
			if err := writeBlobFile(r, p, th); err != nil {
				return Result{}, err
			}
		case bOK && oOK && !tOK && oh == bh:
			// deleted on theirs, unchanged on ours → delete
			_ = os.Remove(filepath.Join(r.Root, filepath.FromSlash(p)))
		case bOK && tOK && !oOK && th == bh:
			// deleted on ours, unchanged on theirs → keep deleted
		case bOK && oOK && !tOK && oh != bh:
			conflicts = append(conflicts, p)
			if err := writeConflict(r, p, oh, object.Zero); err != nil {
				return Result{}, err
			}
		case bOK && tOK && !oOK && th != bh:
			conflicts = append(conflicts, p)
			if err := writeConflict(r, p, object.Zero, th); err != nil {
				return Result{}, err
			}
		case oOK && tOK && oh != th:
			if bOK && oh == bh {
				newIdx.Set(index.Entry{Path: p, Mode: object.ModeFile, Hash: th})
				if err := writeBlobFile(r, p, th); err != nil {
					return Result{}, err
				}
			} else if bOK && th == bh {
				newIdx.Set(index.Entry{Path: p, Mode: object.ModeFile, Hash: oh})
				if err := writeBlobFile(r, p, oh); err != nil {
					return Result{}, err
				}
			} else {
				conflicts = append(conflicts, p)
				if err := writeConflict(r, p, oh, th); err != nil {
					return Result{}, err
				}
			}
		case !oOK && !tOK:
			// both deleted
		default:
			if oOK {
				newIdx.Set(index.Entry{Path: p, Mode: object.ModeFile, Hash: oh})
				if err := writeBlobFile(r, p, oh); err != nil {
					return Result{}, err
				}
			}
		}
	}

	if len(conflicts) > 0 {
		if err := index.Save(r.IndexPath(), newIdx); err != nil {
			return Result{}, err
		}
		return Result{Conflicts: conflicts}, fmt.Errorf("merge: conflicts in %s", strings.Join(conflicts, ", "))
	}

	if err := index.Save(r.IndexPath(), newIdx); err != nil {
		return Result{}, err
	}
	tree, err := worktree.WriteTree(r)
	if err != nil {
		return Result{}, err
	}
	msg := "Merge branch '" + theirBranch + "'"
	stamp := "tinygit <tinygit@devlabs> 0 +0000"
	h, err := object.PutCommit(r.Objects(), object.Commit{
		Tree:      tree,
		Parents:   []object.Hash{ours, theirs},
		Author:    stamp,
		Committer: stamp,
		Message:   msg + "\n",
	})
	if err != nil {
		return Result{}, err
	}
	if err := ref.UpdateRef(r, "HEAD", h, object.Zero); err != nil {
		return Result{}, err
	}
	return Result{Commit: h}, nil
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
