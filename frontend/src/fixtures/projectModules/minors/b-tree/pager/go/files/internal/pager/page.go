// Package pager owns the page file: fixed-size checksummed pages, a freelist
// of recycled pages, and a header page that records where everything is.
// Everything above this package talks in page numbers, never byte offsets.
package pager

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
)

const (
	// PageSize is the size of every page in the file.
	PageSize = 4096
	// TrailerSize is the checksum at the end of every page.
	TrailerSize = 4
	// Usable is how many bytes of a page callers may use. The last
	// TrailerSize bytes hold a CRC-32C of the first Usable bytes.
	Usable = PageSize - TrailerSize
)

// PageNo numbers pages from 0. Page 0 is the header and is never handed out,
// so 0 doubles as "no page" everywhere else.
type PageNo uint32

var (
	// ErrChecksum means a page read back does not match its checksum: a torn
	// write or a flipped bit.
	ErrChecksum = errors.New("pager: page checksum mismatch")
	// ErrBadPage means a page number or buffer size that cannot be right.
	ErrBadPage = errors.New("pager: bad page")
	// ErrCorrupt means the file is not a btreekv page file.
	ErrCorrupt = errors.New("pager: corrupt file")
)

// crcTable is the Castagnoli polynomial, the same checksum the WAL uses.
var crcTable = crc32.MakeTable(crc32.Castagnoli)

// Meta is the small amount of state the header page keeps.
type Meta struct {
	// Root is the page number of the tree's root, or 0 for an empty tree.
	Root PageNo
	// PageCount is how many pages the file has, header included.
	PageCount PageNo
	// FreeHead is the first page of the freelist, or 0 when it is empty.
	FreeHead PageNo
}

var headerMagic = [4]byte{'B', 'T', 'K', 'V'}

const headerVersion = 1

// encodeHeader lays m out in buf, a PageSize page.
//
//	[0:4] magic  [4:8] version  [8:12] page size
//	[12:16] root  [16:20] page count  [20:24] free head
func encodeHeader(buf []byte, m Meta) {
	clear(buf)
	copy(buf[0:4], headerMagic[:])
	binary.LittleEndian.PutUint32(buf[4:], headerVersion)
	binary.LittleEndian.PutUint32(buf[8:], PageSize)
	binary.LittleEndian.PutUint32(buf[12:], uint32(m.Root))
	binary.LittleEndian.PutUint32(buf[16:], uint32(m.PageCount))
	binary.LittleEndian.PutUint32(buf[20:], uint32(m.FreeHead))
}

func decodeHeader(buf []byte) (Meta, error) {
	if string(buf[0:4]) != string(headerMagic[:]) {
		return Meta{}, fmt.Errorf("%w: bad magic", ErrCorrupt)
	}
	if v := binary.LittleEndian.Uint32(buf[4:]); v != headerVersion {
		return Meta{}, fmt.Errorf("%w: unsupported version %d", ErrCorrupt, v)
	}
	if ps := binary.LittleEndian.Uint32(buf[8:]); ps != PageSize {
		return Meta{}, fmt.Errorf("%w: page size %d, want %d", ErrCorrupt, ps, PageSize)
	}
	m := Meta{
		Root:      PageNo(binary.LittleEndian.Uint32(buf[12:])),
		PageCount: PageNo(binary.LittleEndian.Uint32(buf[16:])),
		FreeHead:  PageNo(binary.LittleEndian.Uint32(buf[20:])),
	}
	if m.PageCount < 1 {
		return Meta{}, fmt.Errorf("%w: page count 0", ErrCorrupt)
	}
	return m, nil
}

var freeMagic = [4]byte{'F', 'R', 'E', 'E'}

// EncodeFreePage lays out a free page in buf, a PageSize page: a marker and
// the number of the next free page (0 ends the list). The WAL layer uses this
// to log a freed page exactly as Free would write it.
func EncodeFreePage(buf []byte, next PageNo) {
	clear(buf)
	copy(buf[0:4], freeMagic[:])
	binary.LittleEndian.PutUint32(buf[4:], uint32(next))
}

func decodeFreePage(buf []byte) (PageNo, error) {
	if string(buf[0:4]) != string(freeMagic[:]) {
		return 0, fmt.Errorf("%w: page on the freelist is not a free page", ErrCorrupt)
	}
	return PageNo(binary.LittleEndian.Uint32(buf[4:])), nil
}

// checkBuf rejects a buffer that is not exactly one page.
func checkBuf(buf []byte) error {
	if len(buf) != PageSize {
		return fmt.Errorf("%w: buffer is %d bytes, want %d", ErrBadPage, len(buf), PageSize)
	}
	return nil
}
