package session

// Guard rejects stale or replayed strong trip mutations for a client session.
// Soft location updates may lag; ConfirmPickup / AdvanceTrip must not.
type Guard struct {
	// last[tripID] = (epoch, seq) of the last accepted mutation for that trip.
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

// Accept returns true only when this strong mutation is fresher than what
// this guard has already accepted for tripID.
//
// ── TODO(1.3) ──
//
// Rules:
//  1. First accept for a trip succeeds and records (sessionEpoch, seq).
//  2. Later accepts require a strictly newer pair: higher epoch, or same
//     epoch with higher seq.
//  3. Identical or behind pairs return false (replay / stale).
func (g *Guard) Accept(tripID string, sessionEpoch, seq uint64) bool {
	panic("TODO(1.3)")
}
