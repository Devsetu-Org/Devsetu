package buffer

// victim picks the frame to reuse with the clock algorithm. The caller holds
// p.mu.
//
// The hand sweeps the frames in a circle. An unused frame is taken at once. A
// pinned frame is skipped. A frame whose ref bit is set gets a second chance:
// the bit is cleared and the hand moves on. The first unpinned frame whose
// ref bit is already clear is the victim.
func (p *Pool) victim() (int, error) {
	// TODO(4.2): Sweep at most 2*len(p.frames) steps, so a full lap can clear every ref
	// bit before the next lap picks a frame. Each step: i := p.hand, then
	// advance p.hand = (p.hand+1) % len(p.frames), f := &p.frames[i].
	// !f.used: return i. f.pins > 0: skip. f.ref: clear it and skip.
	// Otherwise return i. If no step found a frame, every frame is pinned:
	// return ErrPoolFull.
	panic("TODO(4.2): victim")
}
