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
	//
	// A crash in the middle of overwriting the file would leave half of the
	// old state and half of the new. Instead:
	//
	//  1. Write state to f.tempPath() (os.OpenFile with O_WRONLY|O_CREATE|
	//     O_TRUNC), file.Sync(), file.Close().
	//  2. os.Rename the temp file over f.finalPath(). Rename is atomic: a
	//     reader sees all of the old file or all of the new one.
	//  3. Open the directory and Sync it, so the rename itself survives a
	//     power cut.
	//
	// Return the first error. Add "errors" to the imports for 4.4.
	panic("TODO(4.3): Save — temp file, fsync, rename, fsync the directory")
}

// Load returns the saved state, or nil if there is none.
func (f *File) Load() ([]byte, error) {
	// ── TODO(4.4) — read what was renamed, nothing else ────────────────────
	//
	// os.ReadFile(f.finalPath()). A missing file means "never saved": return
	// nil, nil (errors.Is(err, os.ErrNotExist)). Any other error is returned.
	//
	// Never read the temp file. It may be half-written, and its presence only
	// means a Save was interrupted: the old state is still the truth.
	panic("TODO(4.4): Load — read the final file, missing means empty")
}
