package buffer

// victim picks the frame to reuse with the clock algorithm. The caller holds
// p.mu.
//
// The hand sweeps the frames in a circle. An unused frame is taken at once. A
// pinned frame is skipped. A frame whose ref bit is set gets a second chance:
// the bit is cleared and the hand moves on. The first unpinned frame whose
// ref bit is already clear is the victim.
func (p *Pool) victim() (int, error) {
	for step := 0; step < 2*len(p.frames); step++ {
		i := p.hand
		p.hand = (p.hand + 1) % len(p.frames)
		f := &p.frames[i]
		switch {
		case !f.used:
			return i, nil
		case f.pins > 0:
		case f.ref:
			f.ref = false
		default:
			return i, nil
		}
	}
	return 0, ErrPoolFull
}
