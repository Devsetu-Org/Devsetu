// Package manifest records which tables make up the store. A table file that
// is not named in the manifest is not part of the store, whatever is on disk.
package manifest

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// FileName is the manifest inside the data directory.
const FileName = "MANIFEST"

const header = "lsmkv-manifest v1"

// ErrCorrupt means the manifest does not parse.
var ErrCorrupt = errors.New("manifest: corrupt")

// State is the set of live tables.
//
// On disk it is a short text file:
//
//	lsmkv-manifest v1
//	next 12
//	table 11
//	table 10
//	table 7
type State struct {
	// NextFile is the number the next new table will get.
	NextFile uint64
	// Tables are the live table numbers, newest data first. After a
	// compaction a newer number can sit behind older ones: the order here,
	// not the number, says which table wins.
	Tables []uint64
}

func encode(s State) []byte {
	var b bytes.Buffer
	fmt.Fprintln(&b, header)
	fmt.Fprintf(&b, "next %d\n", s.NextFile)
	for _, t := range s.Tables {
		fmt.Fprintf(&b, "table %d\n", t)
	}
	return b.Bytes()
}

// Load reads the manifest in dir. A missing manifest is an empty store.
func Load(dir string) (State, error) {
	data, err := os.ReadFile(filepath.Join(dir, FileName))
	if errors.Is(err, fs.ErrNotExist) {
		return State{NextFile: 1}, nil
	}
	if err != nil {
		return State{}, err
	}
	sc := bufio.NewScanner(bytes.NewReader(data))
	if !sc.Scan() || sc.Text() != header {
		return State{}, ErrCorrupt
	}
	var s State
	for sc.Scan() {
		field, value, ok := strings.Cut(sc.Text(), " ")
		n, err := strconv.ParseUint(value, 10, 64)
		if !ok || err != nil {
			return State{}, ErrCorrupt
		}
		switch field {
		case "next":
			s.NextFile = n
		case "table":
			s.Tables = append(s.Tables, n)
		default:
			return State{}, ErrCorrupt
		}
	}
	if s.NextFile == 0 {
		return State{}, ErrCorrupt
	}
	return s, nil
}

// Save replaces the manifest in dir with s, atomically: after a crash the
// manifest is either entirely the old one or entirely the new one.
func Save(dir string, s State) error {
	tmp := filepath.Join(dir, FileName+".tmp")
	// TODO(5.2): write encode(s) to tmp (create or truncate), fsync it, and
	// close it. Then rename tmp over FileName and syncDir(dir). Never write
	// to MANIFEST directly: a crash mid-write would leave no valid manifest.
	_ = tmp
	panic("TODO(5.2): Save")
}

func syncDir(dir string) error {
	f, err := os.Open(dir)
	if err != nil {
		return err
	}
	err = f.Sync()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	return err
}
