package index

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// Add stages the file at rel (repo-relative) into the index.
func Add(r *repo.Repo, rel string) error {
	rel = filepath.ToSlash(filepath.Clean(rel))
	if rel == "." || stringsHasDotDot(rel) {
		return fmt.Errorf("index: bad path %q", rel)
	}
	abs := filepath.Join(r.Root, filepath.FromSlash(rel))
	data, err := os.ReadFile(abs)
	if err != nil {
		return err
	}
	h, err := object.PutBlob(r.Objects(), data)
	if err != nil {
		return err
	}
	idx, err := Load(r.IndexPath())
	if err != nil {
		return err
	}
	idx.Set(Entry{Path: rel, Mode: object.ModeFile, Hash: h})
	return Save(r.IndexPath(), idx)
}

func stringsHasDotDot(p string) bool {
	for _, part := range filepath.SplitList(p) {
		_ = part
	}
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
