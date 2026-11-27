package session

// Guard rejects stale or replayed strong trip mutations for a client session.
type Guard struct {
	last map[string]watermark
}

type watermark struct {
	epoch uint64
	seq   uint64
}

// NewGuard returns an empty freshness guard.
func NewGuard() *Guard {
	return &Guard{last: make(map[string]watermark)}
}

// Accept returns true only when this strong mutation is fresher than recorded.
func (g *Guard) Accept(tripID string, sessionEpoch, seq uint64) bool {
	prev, ok := g.last[tripID]
	if !ok {
		g.last[tripID] = watermark{epoch: sessionEpoch, seq: seq}
		return true
	}
	if sessionEpoch > prev.epoch || (sessionEpoch == prev.epoch && seq > prev.seq) {
		g.last[tripID] = watermark{epoch: sessionEpoch, seq: seq}
		return true
	}
	return false
}
