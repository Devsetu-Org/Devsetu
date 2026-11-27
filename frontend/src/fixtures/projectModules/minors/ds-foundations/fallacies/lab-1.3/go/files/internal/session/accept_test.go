package session

import "testing"

func TestAcceptFirstForTrip(t *testing.T) {
	g := NewGuard()
	if !g.Accept("T1", 1, 1) {
		t.Fatal("first accept should succeed")
	}
}

func TestAcceptRejectsReplay(t *testing.T) {
	g := NewGuard()
	if !g.Accept("T1", 1, 5) {
		t.Fatal("first accept")
	}
	if g.Accept("T1", 1, 5) {
		t.Fatal("identical replay must be rejected")
	}
}

func TestAcceptRejectsBehindSeq(t *testing.T) {
	g := NewGuard()
	_ = g.Accept("T1", 1, 10)
	if g.Accept("T1", 1, 9) {
		t.Fatal("behind seq must be rejected")
	}
	if g.Accept("T1", 1, 10) {
		t.Fatal("equal seq must be rejected")
	}
}

func TestAcceptNewerSeqSameEpoch(t *testing.T) {
	g := NewGuard()
	_ = g.Accept("T1", 2, 1)
	if !g.Accept("T1", 2, 2) {
		t.Fatal("newer seq same epoch should succeed")
	}
}

func TestAcceptNewerEpoch(t *testing.T) {
	g := NewGuard()
	_ = g.Accept("T1", 1, 100)
	if !g.Accept("T1", 2, 0) {
		t.Fatal("newer epoch should succeed even with smaller seq")
	}
	if g.Accept("T1", 1, 999) {
		t.Fatal("old epoch after bump must be rejected")
	}
}

func TestAcceptIndependentTrips(t *testing.T) {
	g := NewGuard()
	if !g.Accept("T1", 1, 1) || !g.Accept("T2", 1, 1) {
		t.Fatal("independent trips should both accept first mutation")
	}
	if g.Accept("T1", 1, 1) {
		t.Fatal("T1 replay still rejected")
	}
	if !g.Accept("T2", 1, 2) {
		t.Fatal("T2 should advance independently")
	}
}
