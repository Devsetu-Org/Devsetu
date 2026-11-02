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
	Hash     object.Hash // set when detached; zero when symbolic unresolved
}

// ReadHEAD reads .tinygit/HEAD.
func ReadHEAD(r *repo.Repo) (HEAD, error) {
	b, err := os.ReadFile(filepath.Join(r.GitDir(), "HEAD"))
	if err != nil {
		return HEAD{}, err
	}
	s := strings.TrimSpace(string(b))
	if strings.HasPrefix(s, "ref: ") {
		return HEAD{Symbolic: strings.TrimSpace(strings.TrimPrefix(s, "ref: "))}, nil
	}
	h, err := object.ParseHex(s)
	if err != nil {
		return HEAD{}, fmt.Errorf("ref: bad HEAD: %w", err)
	}
	return HEAD{Hash: h}, nil
}

// ResolveHEAD returns the commit hash HEAD currently names.
func ResolveHEAD(r *repo.Repo) (object.Hash, error) {
	h, err := ReadHEAD(r)
	if err != nil {
		return object.Zero, err
	}
	if h.Symbolic != "" {
		return Read(r, h.Symbolic)
	}
	return h.Hash, nil
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
