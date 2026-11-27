package location

// Update is one soft driver location blob from a phone.
// DriverID identifies the car; Seq increases for that driver's stream.
// Lat/Lng are the pin; SizeBytes is payload weight on a constrained link.
type Update struct {
	DriverID  string
	Seq       uint64
	Lat, Lng  float64
	SizeBytes int
}

// Coalesce thins chatty location spam so strong trip RPCs are not starved
// on a narrow link.
//
// ── TODO(1.2) ──
//
// Rules:
//  1. Keep at most one update per DriverID — the one with the highest Seq
//     (newest pin wins when you must drop).
//  2. Preserve relative order of the first time each surviving driver appears
//     in the input (stable among distinct drivers).
//  3. Under spam, the returned slice must be shorter than the input when the
//     input has duplicate DriverIDs.
func Coalesce(raw []Update) []Update {
	panic("TODO(1.2)")
}
