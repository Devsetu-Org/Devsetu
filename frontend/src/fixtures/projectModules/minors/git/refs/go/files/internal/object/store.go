package object

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Store is a loose-object directory (…/.tinygit/objects).
type Store struct {
	Dir string
}

// Put writes a zlib-compressed object and returns its content hash.
func (s *Store) Put(typ string, content []byte) (Hash, error) {
	raw := EncodeHeader(typ, content)
	h := HashOf(raw)

	path := s.pathFor(h)
	if _, err := os.Stat(path); err == nil {
		return h, nil
	} else if !os.IsNotExist(err) {
		return Zero, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return Zero, err
	}

	var buf bytes.Buffer
	w := zlib.NewWriter(&buf)
	if _, err := w.Write(raw); err != nil {
		return Zero, err
	}
	if err := w.Close(); err != nil {
		return Zero, err
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, buf.Bytes(), 0o644); err != nil {
		return Zero, err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return Zero, err
	}
	return h, nil
}

// Get reads and inflates a loose object.
func (s *Store) Get(h Hash) (typ string, content []byte, err error) {
	path := s.pathFor(h)
	compressed, err := os.ReadFile(path)
	if err != nil {
		return "", nil, err
	}
	r, err := zlib.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return "", nil, fmt.Errorf("object: zlib: %w", err)
	}
	defer r.Close()
	raw, err := io.ReadAll(r)
	if err != nil {
		return "", nil, err
	}
	typ, content, err = SplitHeader(raw)
	if err != nil {
		return "", nil, err
	}
	if HashOf(raw) != h {
		return "", nil, fmt.Errorf("object: hash mismatch for %s", h)
	}
	return typ, content, nil
}

func (s *Store) pathFor(h Hash) string {
	hex := h.Hex()
	return filepath.Join(s.Dir, hex[:2], hex[2:])
}
