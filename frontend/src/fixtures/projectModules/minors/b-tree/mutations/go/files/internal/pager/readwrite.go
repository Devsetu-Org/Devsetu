package pager

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
)

// WritePage writes buf, which must be exactly PageSize bytes, as page no. Only
// the first Usable bytes are kept: the last TrailerSize bytes of the page on
// disk are a fresh CRC-32C of those bytes. WritePage does not modify buf.
func (p *Pager) WritePage(no PageNo, buf []byte) error {
	if err := checkBuf(buf); err != nil {
		return err
	}
	var page [PageSize]byte
	copy(page[:Usable], buf[:Usable])
	binary.LittleEndian.PutUint32(page[Usable:], crc32.Checksum(page[:Usable], crcTable))
	_, err := p.f.WriteAt(page[:], int64(no)*PageSize)
	return err
}

// ReadPage fills buf, which must be exactly PageSize bytes, with page no and
// verifies its checksum. A page that fails the check returns ErrChecksum; a
// page past the end of the file returns ErrBadPage.
func (p *Pager) ReadPage(no PageNo, buf []byte) error {
	if err := checkBuf(buf); err != nil {
		return err
	}
	n, err := p.f.ReadAt(buf, int64(no)*PageSize)
	if n < PageSize {
		if err == nil || errors.Is(err, io.EOF) {
			return fmt.Errorf("%w: page %d is past the end of the file", ErrBadPage, no)
		}
		return err
	}
	want := binary.LittleEndian.Uint32(buf[Usable:])
	if got := crc32.Checksum(buf[:Usable], crcTable); got != want {
		return fmt.Errorf("%w: page %d", ErrChecksum, no)
	}
	return nil
}
