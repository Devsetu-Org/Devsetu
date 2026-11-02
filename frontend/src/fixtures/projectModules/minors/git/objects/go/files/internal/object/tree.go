package object

import (
	"fmt"
)

const TypeTree = "tree"

// ModeFile and ModeTree are the modes tinygit stores in trees.
const (
	ModeFile = "100644"
	ModeTree = "040000"
)

// TreeEntry is one name in a tree object.
type TreeEntry struct {
	Mode string
	Name string
	Hash Hash
}

// EncodeTree serializes entries in Git tree format, sorted by name.
func EncodeTree(entries []TreeEntry) ([]byte, error) {
	// TODO(1.4): Copy and sort by Name. For each entry write "mode name\x00" + 20-byte hash.
	// Reject empty names, names with / or NUL, and modes other than ModeFile/ModeTree.
	// Imports: bytes, sort.
	panic("TODO(1.4): EncodeTree")
}

// DecodeTree parses a tree object body.
func DecodeTree(content []byte) ([]TreeEntry, error) {
	// TODO(1.4): Loop: mode until space, name until NUL, then 20 raw hash bytes.
	panic("TODO(1.4): DecodeTree")
}

// PutTree encodes and stores a tree.
func PutTree(s *Store, entries []TreeEntry) (Hash, error) {
	body, err := EncodeTree(entries)
	if err != nil {
		return Zero, err
	}
	return s.Put(TypeTree, body)
}

// GetTree loads and decodes a tree.
func GetTree(s *Store, h Hash) ([]TreeEntry, error) {
	typ, content, err := s.Get(h)
	if err != nil {
		return nil, err
	}
	if typ != TypeTree {
		return nil, fmtType(typ, TypeTree)
	}
	return DecodeTree(content)
}

func fmtType(got, want string) error {
	return fmt.Errorf("object: want %s got %s", want, got)
}
