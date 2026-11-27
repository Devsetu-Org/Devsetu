package client

import (
	"strings"
	"testing"
	"time"

	"github.com/devlabs/ridernet/internal/dispatch"
	"github.com/devlabs/ridernet/internal/netsim"
)

func setup(t *testing.T, seed int64) (*netsim.Network, *Client) {
	t.Helper()
	net := netsim.New(seed)
	dispatch.NewServer().Register(net)
	return net, New(net, 5)
}

// Naive* tests document the fallacy. They use CallOnce and are expected to
// show loss. They do not require TODO(1.1).

func TestNaiveClientLosesUnderPacketLoss(t *testing.T) {
	net, c := setup(t, 42)
	net.SetLoss(0.25)

	const n = 80
	var failed int
	for i := 0; i < n; i++ {
		_, err := c.TripHopOnce("trip-naive", "match")
		if err != nil {
			failed++
		}
	}
	if failed < 10 {
		t.Fatalf("CallOnce failed %d/%d under 25%% loss; expected many failures (fallacy: network is reliable)", failed, n)
	}
	t.Logf("CallOnce failed %d/%d under 25%% loss — this is the bug Lab 1.1 fixes", failed, n)
}

func TestReliableCallSucceedsOnReliableNetwork(t *testing.T) {
	_, c := setup(t, 1)
	reply, err := c.TripHop("trip-ok", "match")
	if err != nil {
		t.Fatalf("TripHop on reliable network: %v", err)
	}
	if !reply.OK || reply.Step != "match" {
		t.Fatalf("unexpected reply: %+v", reply)
	}
}

func TestReliableCallSurvivesPacketLoss(t *testing.T) {
	net, c := setup(t, 99)
	net.SetLoss(0.20)

	const n = 60
	var failed int
	for i := 0; i < n; i++ {
		if _, err := c.TripHop("trip-loss", "match"); err != nil {
			failed++
		}
	}
	// With 5 attempts and 20% one-way loss, most hops should succeed.
	if failed > 5 {
		t.Fatalf("Call failed %d/%d under 20%% loss with 5 attempts; want at most 5 failures", failed, n)
	}
}

func TestReliableCallExhaustsRetries(t *testing.T) {
	net, c := setup(t, 7)
	net.SetLoss(1.0) // every direction always drops

	_, err := c.TripHop("trip-dead", "match")
	if err == nil {
		t.Fatal("expected error when the network drops everything")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "retry") &&
		!strings.Contains(strings.ToLower(err.Error()), "exhaust") &&
		!strings.Contains(strings.ToLower(err.Error()), "attempt") {
		t.Fatalf("error should mention retries/attempts exhausted; got %v", err)
	}
}

func TestOpenTripLatencyCompounds(t *testing.T) {
	net, c := setup(t, 3)
	net.SetLoss(0)
	net.SetDelay(40*time.Millisecond, 60*time.Millisecond)

	start := time.Now()
	if err := c.OpenTrip("trip-serial"); err != nil {
		t.Fatalf("OpenTrip: %v", err)
	}
	elapsed := time.Since(start)

	// Five sequential hops × ~50ms delay ⇒ well above 150ms. A broken client
	// that skipped hops or parallelized would finish too fast.
	if elapsed < 150*time.Millisecond {
		t.Fatalf("OpenTrip took %v; want >= 150ms (5 serial hops with ~50ms delay)", elapsed)
	}
	t.Logf("OpenTrip took %v — latency compounds across serial RPCs", elapsed)
}
