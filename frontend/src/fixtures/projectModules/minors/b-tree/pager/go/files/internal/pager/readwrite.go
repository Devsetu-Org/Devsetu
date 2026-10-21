package pager

// WritePage writes buf, which must be exactly PageSize bytes, as page no. Only
// the first Usable bytes are kept: the last TrailerSize bytes of the page on
// disk are a fresh CRC-32C of those bytes. WritePage does not modify buf.
func (p *Pager) WritePage(no PageNo, buf []byte) error {
	// TODO(1.1): Call checkBuf(buf) first. Copy buf[:Usable] into a local
	// [PageSize]byte page, store crc32.Checksum(page[:Usable], crcTable) in
	// page[Usable:] with binary.LittleEndian.PutUint32, then write all of page
	// at offset int64(no)*PageSize with p.f.WriteAt. Do not touch buf: callers
	// reuse it.
	//
	// You will need to import encoding/binary and hash/crc32.
	panic("TODO(1.1): WritePage")
}

// ReadPage fills buf, which must be exactly PageSize bytes, with page no and
// verifies its checksum. A page that fails the check returns ErrChecksum; a
// page past the end of the file returns ErrBadPage.
func (p *Pager) ReadPage(no PageNo, buf []byte) error {
	// TODO(1.2): Call checkBuf(buf) first, then p.f.ReadAt(buf, int64(no)*PageSize). If
	// fewer than PageSize bytes came back, return an error wrapping ErrBadPage
	// (a short read at the end of the file is io.EOF). Otherwise compare the
	// trailer, binary.LittleEndian.Uint32(buf[Usable:]), with
	// crc32.Checksum(buf[:Usable], crcTable) and return an error wrapping
	// ErrChecksum on a mismatch.
	//
	// You will need to import errors, fmt, and io as well.
	panic("TODO(1.2): ReadPage")
}
