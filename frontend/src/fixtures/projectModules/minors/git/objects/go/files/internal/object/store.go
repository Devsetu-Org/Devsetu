package object

import (
	"path/filepath"
)

// Store is a loose-object directory (…/.tinygit/objects).
type Store struct {
	Dir string
}

// Put writes a zlib-compressed object and returns its content hash.
func (s *Store) Put(typ string, content []byte) (Hash, error) {
	// TODO(1.2)
	panic("TODO(1.2)")
}

// Get reads and inflates a loose object.
func (s *Store) Get(h Hash) (typ string, content []byte, err error) {
	// TODO(1.2)
	panic("TODO(1.2)")
}

func (s *Store) pathFor(h Hash) string {
	hex := h.Hex()
	return filepath.Join(s.Dir, hex[:2], hex[2:])
}
