package postings

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"sort"
)

const (
	magic   = "FNDX"
	version = uint32(1)
)

// Segment is a read-only on-disk posting dictionary for one flush.
type Segment struct {
	// dir maps term → (offset into data, posting count)
	dir  map[string]entry
	data []byte // raw (docID, tf) pairs region
}

type entry struct {
	off   uint32
	count uint32
}

// WriteSegment encodes m as a segment into w. Terms are stored sorted.
//
// Layout (little-endian):
//
//	magic "FNDX" (4) | version u32 | nTerms u32
//	directory: for each term (sorted): nameLen u16 | name | dataOff u32 | count u32
//	data: for each term in directory order: count × (docID u32 | tf u32)
func WriteSegment(w io.Writer, m *Map) error {
	// TODO(2.2): For each term from m.Terms(), append count×(docID,tf) to a data
	// buffer and a directory entry (nameLen, name, dataOff, count). Write the
	// 12-byte header, then the directory, then the data. Use
	// binary.LittleEndian.AppendUint32 / AppendUint16.
	_ = binary.LittleEndian
	_ = fmt.Errorf
	panic("TODO(2.2): WriteSegment")
}

// OpenSegment loads a segment file from path.
func OpenSegment(path string) (*Segment, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return DecodeSegment(raw)
}

// DecodeSegment parses a segment from bytes.
func DecodeSegment(raw []byte) (*Segment, error) {
	// TODO(2.3): Check magic and version. Read nTerms. Parse the directory into
	// map[string]entry. The remaining bytes are data. Return &Segment{dir, data}.
	panic("TODO(2.3): DecodeSegment")
}

// Postings looks up term. ok is false when the term is absent.
func (s *Segment) Postings(term string) (list []Posting, ok bool) {
	// TODO(2.3): Look up term in s.dir. Read count postings from s.data at off:
	// each posting is docID u32 then tf u32 (little-endian).
	panic("TODO(2.3): Segment.Postings")
}

// Terms returns sorted term names in the segment.
func (s *Segment) Terms() []string {
	out := make([]string, 0, len(s.dir))
	for t := range s.dir {
		out = append(out, t)
	}
	sort.Strings(out)
	return out
}

// DF returns the number of documents that contain term (posting list length).
func (s *Segment) DF(term string) int {
	e, ok := s.dir[term]
	if !ok {
		return 0
	}
	return int(e.count)
}
