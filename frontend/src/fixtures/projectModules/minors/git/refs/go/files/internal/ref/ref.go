package ref

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// Read reads a ref file relative to the git dir (e.g. "refs/heads/main").
func Read(r *repo.Repo, name string) (object.Hash, error) {
	// TODO(2.1): safePath, os.ReadFile, TrimSpace, object.ParseHex.
	panic("TODO(2.1): Read")
}

// Write writes a direct ref (hash only).
func Write(r *repo.Repo, name string, h object.Hash) error {
	// TODO(2.1): safePath, MkdirAll parent, write hex+"\n" via temp+rename. Import os.
	panic("TODO(2.1): Write")
}

func safePath(r *repo.Repo, name string) (string, error) {
	name = strings.TrimPrefix(name, "/")
	if name == "" || strings.Contains(name, "..") {
		return "", fmt.Errorf("ref: bad name %q", name)
	}
	return filepath.Join(r.GitDir(), name), nil
}
