package budget

// DefaultAttempts is the fallback when class is unknown.
const DefaultAttempts = 5

// AttemptBudget returns how many RPC attempts a Fleetline endpoint class
// should use. Classes see different RTTs: cellular riders, city Wi‑Fi drivers,
// and a server sidecar next to dispatch are not the same network.
//
// ── TODO(1.4) ──
//
// class is one of "rider", "driver", "server" (or anything else).
//
// Rules:
//  1. Each known class returns a value ≥ 1.
//  2. The three known classes must not all return the same number
//     (heterogeneous budgets).
//  3. Keep budgets small: no class may return more than DefaultAttempts.
//  4. Unknown class returns DefaultAttempts.
//  5. Prefer giving cellular riders a bit more patience than a server sidecar
//     (rider ≥ driver ≥ server is a valid ordering; equal adjacent pairs OK
//     as long as not all three equal).
func AttemptBudget(class string) int {
	panic("TODO(1.4)")
}
