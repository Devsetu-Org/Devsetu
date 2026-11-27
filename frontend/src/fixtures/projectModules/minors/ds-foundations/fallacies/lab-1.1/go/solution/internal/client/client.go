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
func (c *Client) CallOnce(method string, args, reply any) error {
	if c.net.Call(method, args, reply) {
		return nil
	}
	return fmt.Errorf("rpc %s: no reply (dropped or unreachable)", method)
}

// Call retries a dropped RPC up to maxAttempts times.
func (c *Client) Call(method string, args, reply any) error {
	var last error
	for attempt := 1; attempt <= c.maxAttempts; attempt++ {
		if c.net.Call(method, args, reply) {
			return nil
		}
		last = fmt.Errorf("rpc %s: no reply on attempt %d/%d", method, attempt, c.maxAttempts)
	}
	return fmt.Errorf("%w: retries exhausted", last)
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
func (c *Client) OpenTrip(tripID string) error {
	steps := []string{"request", "match", "confirm", "enroute", "arrived"}
	for _, step := range steps {
		if _, err := c.TripHop(tripID+"/"+step, step); err != nil {
			return fmt.Errorf("%s: %w", step, err)
		}
	}
	return nil
}
