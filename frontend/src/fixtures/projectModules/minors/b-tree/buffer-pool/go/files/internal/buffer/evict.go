package buffer

// victim picks the frame to reuse with the clock algorithm. The caller holds
// p.mu.
//
// The hand sweeps the frames in a circle. An unused frame is taken at once. A
// pinned frame is skipped. A frame whose ref bit is set gets a second chance:
// the bit is cleared and the hand moves on. The first unpinned frame whose
// ref bit is already clear is the victim.
func (p *Pool) victim() (int, error) {
	// TODO(4.2)
	panic("TODO(4.2)")
}
