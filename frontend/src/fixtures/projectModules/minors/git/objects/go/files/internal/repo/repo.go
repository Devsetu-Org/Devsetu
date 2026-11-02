package repo

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/devlabs/tinygit/internal/object"
)

const DirName = ".tinygit"

// Repo is a tinygit repository rooted at Root (the worktree).
type Repo struct {
	Root string
}

// GitDir returns Root/.tinygit.
func (r *Repo) GitDir() string { return filepath.Join(r.Root, DirName) }

// Objects returns the loose-object store.
func (r *Repo) Objects() *object.Store {
	return &object.Store{Dir: filepath.Join(r.GitDir(), "objects")}
}

// IndexPath returns the index file path.
func (r *Repo) IndexPath() string { return filepath.Join(r.GitDir(), "index") }

// Init creates .tinygit/{objects,refs/heads} and a symbolic HEAD to main.
func Init(root string) (*Repo, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	git := filepath.Join(abs, DirName)
	if err := os.MkdirAll(filepath.Join(git, "objects"), 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(git, "refs", "heads"), 0o755); err != nil {
		return nil, err
	}
	head := filepath.Join(git, "HEAD")
	if _, err := os.Stat(head); os.IsNotExist(err) {
		if err := os.WriteFile(head, []byte("ref: refs/heads/main\n"), 0o644); err != nil {
			return nil, err
		}
	}
	return &Repo{Root: abs}, nil
}

// Open finds .tinygit walking up from path, or uses path if it contains one.
func Open(path string) (*Repo, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	cur := abs
	for {
		git := filepath.Join(cur, DirName)
		if st, err := os.Stat(git); err == nil && st.IsDir() {
			return &Repo{Root: cur}, nil
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			return nil, fmt.Errorf("repo: not a tinygit repository")
		}
		cur = parent
	}
}
