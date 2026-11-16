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
	// TODO(2.2)
	_ = binary.LittleEndian
	_ = fmt.Errorf
	panic("TODO(2.2)")
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
	// TODO(2.3)
	panic("TODO(2.3)")
}

// Postings looks up term. ok is false when the term is absent.
func (s *Segment) Postings(term string) (list []Posting, ok bool) {
	// TODO(2.3)
	panic("TODO(2.3)")
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
