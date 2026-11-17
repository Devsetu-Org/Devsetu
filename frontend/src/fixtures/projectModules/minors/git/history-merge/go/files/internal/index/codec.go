package index

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

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
	cp := append([]Entry(nil), idx.Entries...)
	sort.Slice(cp, func(i, j int) bool { return cp[i].Path < cp[j].Path })
	var b strings.Builder
	fmt.Fprintf(&b, "%s %d\n", magic, version)
	for _, e := range cp {
		if e.Path == "" || strings.Contains(e.Path, "\n") || strings.Contains(e.Path, "\t") {
			return nil, fmt.Errorf("index: bad path %q", e.Path)
		}
		fmt.Fprintf(&b, "%s\t%s\t%s\n", e.Path, e.Mode, e.Hash.Hex())
	}
	return []byte(b.String()), nil
}

// Decode parses an index file body.
func Decode(data []byte) (Index, error) {
	sc := bufio.NewScanner(strings.NewReader(string(data)))
	if !sc.Scan() {
		return Index{}, fmt.Errorf("index: empty")
	}
	var ver int
	var mag string
	if _, err := fmt.Sscanf(sc.Text(), "%s %d", &mag, &ver); err != nil || mag != magic {
		return Index{}, fmt.Errorf("index: bad header %q", sc.Text())
	}
	if ver != version {
		return Index{}, fmt.Errorf("index: unsupported version %d", ver)
	}
	var entries []Entry
	for sc.Scan() {
		line := sc.Text()
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) != 3 {
			return Index{}, fmt.Errorf("index: bad line %q", line)
		}
		h, err := object.ParseHex(parts[2])
		if err != nil {
			return Index{}, err
		}
		entries = append(entries, Entry{Path: parts[0], Mode: parts[1], Hash: h})
	}
	if err := sc.Err(); err != nil {
		return Index{}, err
	}
	return Index{Entries: entries}, nil
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

// MustAtoi is a tiny helper used by tests.
func MustAtoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		panic(err)
	}
	return n
}
