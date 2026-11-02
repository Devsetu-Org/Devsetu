package index

import (
	"path/filepath"

	"github.com/devlabs/tinygit/internal/repo"
)

// Add stages the file at rel (repo-relative) into the index.
func Add(r *repo.Repo, rel string) error {
	// TODO(3.2): Clean to slash path; reject "..".
	// Read worktree file, object.PutBlob, Load index, Set Entry{Path, ModeFile, Hash}, Save.
	// Imports: fmt, os, object.
	panic("TODO(3.2): Add")
}

func stringsHasDotDot(p string) bool {
	for _, part := range splitSlash(p) {
		if part == ".." {
			return true
		}
	}
	return false
}

func splitSlash(p string) []string {
	var out []string
	start := 0
	for i := 0; i < len(p); i++ {
		if p[i] == '/' {
			if i > start {
				out = append(out, p[start:i])
			}
			start = i + 1
		}
	}
	if start < len(p) {
		out = append(out, p[start:])
	}
	return out
}

var _ = filepath.Separator
