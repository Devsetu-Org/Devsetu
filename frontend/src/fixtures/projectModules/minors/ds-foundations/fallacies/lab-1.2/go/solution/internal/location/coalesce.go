package location

// Update is one soft driver location blob from a phone.
type Update struct {
	DriverID  string
	Seq       uint64
	Lat, Lng  float64
	SizeBytes int
}

// Coalesce keeps the newest pin per driver, in first-seen driver order.
func Coalesce(raw []Update) []Update {
	best := map[string]Update{}
	order := make([]string, 0)
	for _, u := range raw {
		prev, seen := best[u.DriverID]
		if !seen {
			order = append(order, u.DriverID)
			best[u.DriverID] = u
			continue
		}
		if u.Seq >= prev.Seq {
			best[u.DriverID] = u
		}
	}
	out := make([]Update, 0, len(order))
	for _, id := range order {
		out = append(out, best[id])
	}
	return out
}
