package ref

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// Read reads a ref file relative to the git dir (e.g. "refs/heads/main").
func Read(r *repo.Repo, name string) (object.Hash, error) {
	path, err := safePath(r, name)
	if err != nil {
		return object.Zero, err
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return object.Zero, err
	}
	s := strings.TrimSpace(string(b))
	return object.ParseHex(s)
}

// Write writes a direct ref (hash only).
func Write(r *repo.Repo, name string, h object.Hash) error {
	path, err := safePath(r, name)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(h.Hex()+"\n"), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func safePath(r *repo.Repo, name string) (string, error) {
	name = strings.TrimPrefix(name, "/")
	if name == "" || strings.Contains(name, "..") {
		return "", fmt.Errorf("ref: bad name %q", name)
	}
	return filepath.Join(r.GitDir(), name), nil
}
