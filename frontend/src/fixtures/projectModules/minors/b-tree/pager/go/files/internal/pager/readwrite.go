package pager

// WritePage writes buf, which must be exactly PageSize bytes, as page no. Only
// the first Usable bytes are kept: the last TrailerSize bytes of the page on
// disk are a fresh CRC-32C of those bytes. WritePage does not modify buf.
func (p *Pager) WritePage(no PageNo, buf []byte) error {
	// TODO(1.1)
	panic("TODO(1.1)")
}

// ReadPage fills buf, which must be exactly PageSize bytes, with page no and
// verifies its checksum. A page that fails the check returns ErrChecksum; a
// page past the end of the file returns ErrBadPage.
func (p *Pager) ReadPage(no PageNo, buf []byte) error {
	// TODO(1.2)
	panic("TODO(1.2)")
}
