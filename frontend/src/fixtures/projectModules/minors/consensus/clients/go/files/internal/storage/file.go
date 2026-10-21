package storage

import (
	"errors"
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

// Save replaces the state atomically: write a temp file, fsync it, rename it
// over the real file, then fsync the directory so the rename itself survives.
func (f *File) Save(state []byte) error {
	tmp := filepath.Join(f.dir, FileName+".tmp")
	file, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	if _, err := file.Write(state); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp, filepath.Join(f.dir, FileName)); err != nil {
		return err
	}
	dir, err := os.Open(f.dir)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

// Load returns the saved state, or nil if there is none. A leftover temp file
// from a crashed Save is ignored: only the renamed file counts.
func (f *File) Load() ([]byte, error) {
	data, err := os.ReadFile(filepath.Join(f.dir, FileName))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}
