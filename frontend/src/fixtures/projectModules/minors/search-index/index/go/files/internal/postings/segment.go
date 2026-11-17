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
	terms := m.Terms()
	var dirBuf, dataBuf []byte
	for _, term := range terms {
		list := m.Postings(term)
		off := uint32(len(dataBuf))
		for _, p := range list {
			dataBuf = binary.LittleEndian.AppendUint32(dataBuf, p.DocID)
			dataBuf = binary.LittleEndian.AppendUint32(dataBuf, p.TF)
		}
		if len(term) > 0xffff {
			return fmt.Errorf("term too long: %q", term)
		}
		dirBuf = binary.LittleEndian.AppendUint16(dirBuf, uint16(len(term)))
		dirBuf = append(dirBuf, term...)
		dirBuf = binary.LittleEndian.AppendUint32(dirBuf, off)
		dirBuf = binary.LittleEndian.AppendUint32(dirBuf, uint32(len(list)))
	}

	hdr := make([]byte, 0, 12)
	hdr = append(hdr, magic...)
	hdr = binary.LittleEndian.AppendUint32(hdr, version)
	hdr = binary.LittleEndian.AppendUint32(hdr, uint32(len(terms)))
	if _, err := w.Write(hdr); err != nil {
		return err
	}
	if _, err := w.Write(dirBuf); err != nil {
		return err
	}
	_, err := w.Write(dataBuf)
	return err
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
	if len(raw) < 12 || string(raw[:4]) != magic {
		return nil, fmt.Errorf("bad segment magic")
	}
	ver := binary.LittleEndian.Uint32(raw[4:8])
	if ver != version {
		return nil, fmt.Errorf("unsupported segment version %d", ver)
	}
	nTerms := binary.LittleEndian.Uint32(raw[8:12])
	dir := make(map[string]entry, nTerms)
	i := 12
	var maxEnd uint32
	for t := uint32(0); t < nTerms; t++ {
		if i+2 > len(raw) {
			return nil, fmt.Errorf("truncated directory")
		}
		nlen := int(binary.LittleEndian.Uint16(raw[i : i+2]))
		i += 2
		if i+nlen+8 > len(raw) {
			return nil, fmt.Errorf("truncated term")
		}
		name := string(raw[i : i+nlen])
		i += nlen
		off := binary.LittleEndian.Uint32(raw[i : i+4])
		count := binary.LittleEndian.Uint32(raw[i+4 : i+8])
		i += 8
		dir[name] = entry{off: off, count: count}
		end := off + count*8
		if end > maxEnd {
			maxEnd = end
		}
	}
	data := raw[i:]
	if uint32(len(data)) < maxEnd {
		return nil, fmt.Errorf("truncated posting data")
	}
	return &Segment{dir: dir, data: data}, nil
}

// Postings looks up term. ok is false when the term is absent.
func (s *Segment) Postings(term string) (list []Posting, ok bool) {
	e, ok := s.dir[term]
	if !ok {
		return nil, false
	}
	list = make([]Posting, e.count)
	base := int(e.off)
	for i := uint32(0); i < e.count; i++ {
		o := base + int(i)*8
		list[i] = Posting{
			DocID: binary.LittleEndian.Uint32(s.data[o : o+4]),
			TF:    binary.LittleEndian.Uint32(s.data[o+4 : o+8]),
		}
	}
	return list, true
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
