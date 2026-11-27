package budget

import "testing"

func TestKnownClassesPositiveAndBounded(t *testing.T) {
	for _, class := range []string{"rider", "driver", "server"} {
		n := AttemptBudget(class)
		if n < 1 {
			t.Fatalf("%s: want ≥ 1, got %d", class, n)
		}
		if n > DefaultAttempts {
			t.Fatalf("%s: want ≤ DefaultAttempts (%d), got %d", class, DefaultAttempts, n)
		}
	}
}

func TestHeterogeneousBudgets(t *testing.T) {
	r, d, s := AttemptBudget("rider"), AttemptBudget("driver"), AttemptBudget("server")
	if r == d && d == s {
		t.Fatalf("rider/driver/server must not all share one budget; got %d/%d/%d", r, d, s)
	}
}

func TestRiderAtLeastAsPatientAsServer(t *testing.T) {
	r, s := AttemptBudget("rider"), AttemptBudget("server")
	if r < s {
		t.Fatalf("rider (%d) should be ≥ server (%d) — cellular needs more patience", r, s)
	}
}

func TestUnknownFallsBack(t *testing.T) {
	if got := AttemptBudget("sidecar-v2"); got != DefaultAttempts {
		t.Fatalf("unknown class: want DefaultAttempts=%d, got %d", DefaultAttempts, got)
	}
	if got := AttemptBudget(""); got != DefaultAttempts {
		t.Fatalf("empty class: want DefaultAttempts=%d, got %d", DefaultAttempts, got)
	}
}
