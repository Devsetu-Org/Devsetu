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
	// TODO(1.2): raw := EncodeHeader(typ, content); h := HashOf(raw).
	// If pathFor(h) already exists, return h.
	// zlib-compress raw (compress/zlib), write via temp+rename under objects/aa/bb….
	// Imports: bytes, compress/zlib, fmt, os.
	panic("TODO(1.2): Store.Put")
}

// Get reads and inflates a loose object.
func (s *Store) Get(h Hash) (typ string, content []byte, err error) {
	// TODO(1.2): Read pathFor(h), zlib.NewReader, io.ReadAll, SplitHeader.
	// Verify HashOf(raw) == h. Imports: bytes, compress/zlib, fmt, io, os.
	panic("TODO(1.2): Store.Get")
}

func (s *Store) pathFor(h Hash) string {
	hex := h.Hex()
	return filepath.Join(s.Dir, hex[:2], hex[2:])
}
