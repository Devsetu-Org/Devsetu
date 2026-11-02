package ref

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// HEAD state: either a symbolic ref or a detached hash.
type HEAD struct {
	Symbolic string      // e.g. "refs/heads/main", empty if detached
	Hash     object.Hash // set when detached
}

// ReadHEAD reads .tinygit/HEAD.
func ReadHEAD(r *repo.Repo) (HEAD, error) {
	// TODO(2.2): Read HEAD file. If it starts with "ref: ", return Symbolic.
	// Otherwise ParseHex into Hash (detached).
	panic("TODO(2.2): ReadHEAD")
}

// ResolveHEAD returns the commit hash HEAD currently names.
func ResolveHEAD(r *repo.Repo) (object.Hash, error) {
	// TODO(2.2): ReadHEAD; if Symbolic, Read that ref; else return Hash.
	panic("TODO(2.2): ResolveHEAD")
}

// WriteSymbolicHEAD points HEAD at a ref name.
func WriteSymbolicHEAD(r *repo.Repo, name string) error {
	name = strings.TrimPrefix(name, "/")
	if name == "" || strings.Contains(name, "..") {
		return fmt.Errorf("ref: bad HEAD target %q", name)
	}
	return os.WriteFile(filepath.Join(r.GitDir(), "HEAD"), []byte("ref: "+name+"\n"), 0o644)
}

// WriteDetachedHEAD points HEAD at a raw commit hash.
func WriteDetachedHEAD(r *repo.Repo, h object.Hash) error {
	return os.WriteFile(filepath.Join(r.GitDir(), "HEAD"), []byte(h.Hex()+"\n"), 0o644)
}
