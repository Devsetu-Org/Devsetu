package storage

import (
	"os"
	"path/filepath"
)

// FileName is the state file inside a File store's directory.
const FileName = "raft-state"

// File is a Store backed by one file in a directory.
type File struct {
	dir string
}

// NewFile returns a Store that keeps its state in dir, creating it if needed.
func NewFile(dir string) (*File, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &File{dir: dir}, nil
}

// tempPath is where Save stages a new state before renaming it into place.
func (f *File) tempPath() string { return filepath.Join(f.dir, FileName+".tmp") }

// finalPath is the one file Load reads.
func (f *File) finalPath() string { return filepath.Join(f.dir, FileName) }

// Save replaces the state atomically.
func (f *File) Save(state []byte) error {
	// ── TODO(4.3) — an atomic, durable replace ─────────────────────────────
	panic("TODO(4.3)")
}

// Load returns the saved state, or nil if there is none.
func (f *File) Load() ([]byte, error) {
	// ── TODO(4.4) — read what was renamed, nothing else ────────────────────
	panic("TODO(4.4)")
}
