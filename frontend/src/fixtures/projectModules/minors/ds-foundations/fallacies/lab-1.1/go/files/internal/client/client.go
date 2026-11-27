package client

import (
	"fmt"

	"github.com/devlabs/ridernet/internal/dispatch"
	"github.com/devlabs/ridernet/internal/netsim"
)

// Client talks to Fleetline dispatch over a simulated network.
type Client struct {
	net         *netsim.Network
	maxAttempts int
}

// New returns a client. maxAttempts is used by Call (tests use 5).
func New(net *netsim.Network, maxAttempts int) *Client {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	return &Client{net: net, maxAttempts: maxAttempts}
}

// CallOnce is the naive path: one network attempt, no retries.
// Leave this alone — it is the control that shows the fallacy.
func (c *Client) CallOnce(method string, args, reply any) error {
	if c.net.Call(method, args, reply) {
		return nil
	}
	return fmt.Errorf("rpc %s: no reply (dropped or unreachable)", method)
}

// Call is a reliable-enough RPC: retry when the network drops the attempt.
//
// ── TODO(1.1) — timeouts are implicit in netsim; you add bounded retries ──
//
// Loop up to c.maxAttempts times. Each time call c.net.Call(method, args, reply).
// On true, return nil. If every attempt fails, return an error that says retries
// were exhausted.
func (c *Client) Call(method string, args, reply any) error {
	panic("TODO(1.1)")
}

// TripHop runs Dispatch.TripHop through Call (your reliable path).
func (c *Client) TripHop(tripID, step string) (dispatch.TripHopReply, error) {
	args := dispatch.TripHopArgs{TripID: tripID, Step: step}
	var reply dispatch.TripHopReply
	if err := c.Call("Dispatch.TripHop", args, &reply); err != nil {
		return dispatch.TripHopReply{}, err
	}
	return reply, nil
}

// TripHopOnce runs Dispatch.TripHop through CallOnce (naive path).
func (c *Client) TripHopOnce(tripID, step string) (dispatch.TripHopReply, error) {
	args := dispatch.TripHopArgs{TripID: tripID, Step: step}
	var reply dispatch.TripHopReply
	if err := c.CallOnce("Dispatch.TripHop", args, &reply); err != nil {
		return dispatch.TripHopReply{}, err
	}
	return reply, nil
}

// OpenTrip models five sequential hops: request → match → confirm → en-route → arrived.
// Each hop is one TripHop via Call. Wall time should grow roughly with hops × one-way
// delay when the network is loss-free.
func (c *Client) OpenTrip(tripID string) error {
	steps := []string{"request", "match", "confirm", "enroute", "arrived"}
	for _, step := range steps {
		if _, err := c.TripHop(tripID+"/"+step, step); err != nil {
			return fmt.Errorf("%s: %w", step, err)
		}
	}
	return nil
}
