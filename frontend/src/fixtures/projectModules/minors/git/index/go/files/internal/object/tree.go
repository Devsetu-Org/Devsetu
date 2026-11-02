package object

import (
	"bytes"
	"fmt"
	"sort"
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
	cp := append([]TreeEntry(nil), entries...)
	sort.Slice(cp, func(i, j int) bool { return cp[i].Name < cp[j].Name })
	var buf bytes.Buffer
	for _, e := range cp {
		if e.Name == "" || bytes.IndexByte([]byte(e.Name), 0) >= 0 || bytes.IndexByte([]byte(e.Name), '/') >= 0 {
			return nil, fmt.Errorf("object: bad tree name %q", e.Name)
		}
		if e.Mode != ModeFile && e.Mode != ModeTree {
			return nil, fmt.Errorf("object: bad mode %q", e.Mode)
		}
		fmt.Fprintf(&buf, "%s %s\x00", e.Mode, e.Name)
		buf.Write(e.Hash[:])
	}
	return buf.Bytes(), nil
}

// DecodeTree parses a tree object body.
func DecodeTree(content []byte) ([]TreeEntry, error) {
	var out []TreeEntry
	i := 0
	for i < len(content) {
		space := bytes.IndexByte(content[i:], ' ')
		if space < 0 {
			return nil, fmt.Errorf("object: bad tree entry")
		}
		space += i
		nul := bytes.IndexByte(content[space+1:], 0)
		if nul < 0 {
			return nil, fmt.Errorf("object: bad tree entry name")
		}
		nul += space + 1
		mode := string(content[i:space])
		name := string(content[space+1 : nul])
		if nul+1+20 > len(content) {
			return nil, fmt.Errorf("object: truncated tree hash")
		}
		var h Hash
		copy(h[:], content[nul+1:nul+1+20])
		out = append(out, TreeEntry{Mode: mode, Name: name, Hash: h})
		i = nul + 1 + 20
	}
	return out, nil
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
