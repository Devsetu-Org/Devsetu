package location

import "testing"

func TestCoalesceEmpty(t *testing.T) {
	if got := Coalesce(nil); len(got) != 0 {
		t.Fatalf("nil input: got %d", len(got))
	}
	if got := Coalesce([]Update{}); len(got) != 0 {
		t.Fatalf("empty input: got %d", len(got))
	}
}

func TestCoalesceKeepsNewestPerDriver(t *testing.T) {
	raw := []Update{
		{DriverID: "d1", Seq: 1, Lat: 1, Lng: 1, SizeBytes: 800},
		{DriverID: "d2", Seq: 1, Lat: 2, Lng: 2, SizeBytes: 800},
		{DriverID: "d1", Seq: 3, Lat: 1.1, Lng: 1.1, SizeBytes: 800},
		{DriverID: "d1", Seq: 2, Lat: 1.05, Lng: 1.05, SizeBytes: 800},
		{DriverID: "d2", Seq: 5, Lat: 2.5, Lng: 2.5, SizeBytes: 800},
	}
	got := Coalesce(raw)
	if len(got) != 2 {
		t.Fatalf("want 2 updates (one per driver), got %d: %+v", len(got), got)
	}
	by := map[string]Update{}
	for _, u := range got {
		by[u.DriverID] = u
	}
	if by["d1"].Seq != 3 || by["d1"].Lat != 1.1 {
		t.Fatalf("d1: want seq=3 lat=1.1, got %+v", by["d1"])
	}
	if by["d2"].Seq != 5 || by["d2"].Lat != 2.5 {
		t.Fatalf("d2: want seq=5 lat=2.5, got %+v", by["d2"])
	}
}

func TestCoalescePreservesFirstSeenDriverOrder(t *testing.T) {
	raw := []Update{
		{DriverID: "a", Seq: 1},
		{DriverID: "b", Seq: 1},
		{DriverID: "c", Seq: 1},
		{DriverID: "b", Seq: 9},
		{DriverID: "a", Seq: 4},
	}
	got := Coalesce(raw)
	if len(got) != 3 {
		t.Fatalf("want 3, got %d", len(got))
	}
	wantOrder := []string{"a", "b", "c"}
	for i, id := range wantOrder {
		if got[i].DriverID != id {
			t.Fatalf("order[%d]: want %s, got %s (%+v)", i, id, got[i].DriverID, got)
		}
	}
	if got[0].Seq != 4 || got[1].Seq != 9 || got[2].Seq != 1 {
		t.Fatalf("newest seqs wrong: %+v", got)
	}
}

func TestCoalesceShortensSpam(t *testing.T) {
	raw := make([]Update, 0, 50)
	for i := 0; i < 50; i++ {
		raw = append(raw, Update{DriverID: "only", Seq: uint64(i + 1), SizeBytes: 1024})
	}
	got := Coalesce(raw)
	if len(got) >= len(raw) {
		t.Fatalf("under spam, coalesced length must shrink; got %d from %d", len(got), len(raw))
	}
	if len(got) != 1 || got[0].Seq != 50 {
		t.Fatalf("want single newest update seq=50, got %+v", got)
	}
}
