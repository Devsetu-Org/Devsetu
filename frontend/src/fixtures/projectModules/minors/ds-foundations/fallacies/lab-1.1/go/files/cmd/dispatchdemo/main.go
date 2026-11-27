package main

import (
	"fmt"

	"github.com/devlabs/ridernet/internal/client"
	"github.com/devlabs/ridernet/internal/dispatch"
	"github.com/devlabs/ridernet/internal/netsim"
)

func main() {
	net := netsim.New(42)
	dispatch.NewServer().Register(net)
	net.SetLoss(0.20)

	c := client.New(net, 5)

	const n = 40
	var naiveFail, reliableFail int
	for i := 0; i < n; i++ {
		if _, err := c.TripHopOnce("demo", "match"); err != nil {
			naiveFail++
		}
		if _, err := c.TripHop("demo", "match"); err != nil {
			reliableFail++
		}
	}

	fmt.Printf("under 20%% loss, %d MatchDriver-style hops:\n", n)
	fmt.Printf("  CallOnce  failures: %d/%d  (naive — assumes the network is reliable)\n", naiveFail, n)
	fmt.Printf("  Call      failures: %d/%d  (retries — TODO(1.1) until you implement it)\n", reliableFail, n)
}
