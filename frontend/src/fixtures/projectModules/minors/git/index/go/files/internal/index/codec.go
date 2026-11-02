package index

import (
	"os"
	"strconv"

	"github.com/devlabs/tinygit/internal/object"
)

const magic = "TINYIDX"
const version = 1

// Entry is one staged path.
type Entry struct {
	Path string
	Mode string
	Hash object.Hash
}

// Index is the staging table.
type Index struct {
	Entries []Entry
}

// Encode serializes the index to the custom text format.
func Encode(idx Index) ([]byte, error) {
	// TODO(3.1): Header "TINYIDX 1\n". Sort entries by Path.
	// Each line: path\tmode\thash\n. Reject paths with newline or tab.
	// Imports: fmt, sort, strings.
	panic("TODO(3.1): Encode")
}

// Decode parses an index file body.
func Decode(data []byte) (Index, error) {
	// TODO(3.1): Parse header, then tab-separated lines into Entries.
	// Imports: bufio, fmt, strings.
	panic("TODO(3.1): Decode")
}

// Load reads the index from disk; missing file yields an empty index.
func Load(path string) (Index, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Index{}, nil
		}
		return Index{}, err
	}
	return Decode(b)
}

// Save writes the index atomically.
func Save(path string, idx Index) error {
	data, err := Encode(idx)
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Get returns the entry for path, if any.
func (idx Index) Get(path string) (Entry, bool) {
	for _, e := range idx.Entries {
		if e.Path == path {
			return e, true
		}
	}
	return Entry{}, false
}

// Set upserts an entry by path.
func (idx *Index) Set(e Entry) {
	for i := range idx.Entries {
		if idx.Entries[i].Path == e.Path {
			idx.Entries[i] = e
			return
		}
	}
	idx.Entries = append(idx.Entries, e)
}

// Remove deletes a path from the index.
func (idx *Index) Remove(path string) {
	out := idx.Entries[:0]
	for _, e := range idx.Entries {
		if e.Path != path {
			out = append(out, e)
		}
	}
	idx.Entries = out
}

func MustAtoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		panic(err)
	}
	return n
}
