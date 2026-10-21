// Package labrpc is an in-process RPC network that misbehaves on request.
//
// Nodes talk through ClientEnds. Every message is gob-encoded on the way out
// and decoded on the way in, so sender and receiver never share memory, just
// like two processes. The Network can cut nodes off, split them into
// partitions, add latency, and drop or duplicate messages. A Call that does not
// get an answer returns false; the caller cannot tell a lost request from a
// lost reply, exactly as over a real network.
package labrpc

import (
	"bytes"
	"encoding/gob"
	"errors"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// Handler is the receiving side of a node.
type Handler interface {
	// Handle decodes args for method, runs it, and returns the encoded reply.
	// An error means the node could not answer; the caller sees a failed Call.
	Handle(method string, args []byte) ([]byte, error)
}

// Encode gob-encodes v.
func Encode(v any) []byte {
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(v); err != nil {
		panic("labrpc: encode: " + err.Error())
	}
	return buf.Bytes()
}

// Decode gob-decodes data into v, which must be a pointer.
func Decode(data []byte, v any) error {
	return gob.NewDecoder(bytes.NewReader(data)).Decode(v)
}

// ExternalBase is the first id of a client that sits outside the cluster.
// Partitions split the servers only: an external caller can reach every
// server that is up and not disconnected, like a client on the open internet.
const ExternalBase = 1000

// Network connects numbered nodes.
type Network struct {
	mu        sync.Mutex
	rng       *rand.Rand
	handlers  map[int]Handler
	isolated  map[int]bool
	group     map[int]int
	dropRate  float64
	dupRate   float64
	minDelay  time.Duration
	maxDelay  time.Duration
	delivered atomic.Int64
}

// NewNetwork returns a reliable, fully connected network. seed makes the
// random choices (drops, delays) repeatable, though goroutine timing is not.
func NewNetwork(seed int64) *Network {
	return &Network{
		rng:      rand.New(rand.NewSource(seed)),
		handlers: map[int]Handler{},
		isolated: map[int]bool{},
		group:    map[int]int{},
	}
}

// Add registers the node that answers calls to id.
func (n *Network) Add(id int, h Handler) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.handlers[id] = h
}

// Remove unplugs a node, as if the machine died. Calls to it fail.
func (n *Network) Remove(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	delete(n.handlers, id)
}

// Disconnect cuts id off from every other node, in both directions.
func (n *Network) Disconnect(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.isolated[id] = true
}

// Connect undoes Disconnect.
func (n *Network) Connect(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	delete(n.isolated, id)
}

// Partition splits the network: nodes talk only to nodes in the same group.
// Nodes not listed in any group form one more group together.
func (n *Network) Partition(groups ...[]int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.group = map[int]int{}
	for g, members := range groups {
		for _, id := range members {
			n.group[id] = g + 1
		}
	}
}

// Heal removes every partition and reconnects every node.
func (n *Network) Heal() {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.group = map[int]int{}
	n.isolated = map[int]bool{}
}

// SetUnreliable turns on message loss and duplication: each direction of each
// call is dropped with probability drop, and each delivered request is also
// delivered a second time with probability dup. Pass 0, 0 to turn it off.
func (n *Network) SetUnreliable(drop, dup float64) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.dropRate, n.dupRate = drop, dup
}

// SetDelay gives every message a random one-way latency in [min, max].
func (n *Network) SetDelay(min, max time.Duration) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.minDelay, n.maxDelay = min, max
}

// Delivered is how many requests reached a handler (duplicates included).
func (n *Network) Delivered() int64 { return n.delivered.Load() }

// reachable reports whether a message from -> to can cross right now.
// The caller holds n.mu.
func (n *Network) reachable(from, to int) bool {
	if n.isolated[from] || n.isolated[to] {
		return false
	}
	if from < ExternalBase && n.group[from] != n.group[to] {
		return false
	}
	_, up := n.handlers[to]
	return up
}

func (n *Network) roll(p float64) bool {
	return p > 0 && n.rng.Float64() < p
}

func (n *Network) latency() time.Duration {
	if n.maxDelay <= 0 {
		return 0
	}
	span := n.maxDelay - n.minDelay
	if span <= 0 {
		return n.minDelay
	}
	return n.minDelay + time.Duration(n.rng.Int63n(int64(span)))
}

// failDelay is how long a caller waits before learning a call failed. A real
// network would time out; waiting a little keeps retry loops from spinning.
func (n *Network) failDelay() time.Duration {
	return time.Duration(5+n.rng.Intn(20)) * time.Millisecond
}

// ClientEnd is one node's handle for calling another.
type ClientEnd struct {
	net    *Network
	from   int
	to     int
	closed atomic.Bool
}

// End returns the handle node from uses to call node to.
func (n *Network) End(from, to int) *ClientEnd {
	return &ClientEnd{net: n, from: from, to: to}
}

// Close makes every later Call on this end fail. A crashed node's old ends
// are closed so a zombie goroutine cannot keep talking.
func (e *ClientEnd) Close() { e.closed.Store(true) }

var errDown = errors.New("labrpc: node is down")

// Call sends args to method on the remote node and waits. reply must point to
// a fresh zero value. It returns false when the request or the reply was lost,
// delayed past a partition, or the node is down.
func (e *ClientEnd) Call(method string, args, reply any) bool {
	n := e.net
	payload := Encode(args)

	n.mu.Lock()
	if e.closed.Load() || !n.reachable(e.from, e.to) {
		wait := n.failDelay()
		n.mu.Unlock()
		time.Sleep(wait)
		return false
	}
	dropReq := n.roll(n.dropRate)
	dropRep := n.roll(n.dropRate)
	dup := n.roll(n.dupRate)
	reqDelay, repDelay, dupDelay := n.latency(), n.latency(), n.latency()
	h := n.handlers[e.to]
	failWait := n.failDelay()
	n.mu.Unlock()

	time.Sleep(reqDelay)
	if dropReq || e.cut() {
		time.Sleep(failWait)
		return false
	}

	if dup {
		go func() {
			time.Sleep(dupDelay)
			n.delivered.Add(1)
			h.Handle(method, append([]byte(nil), payload...))
		}()
	}
	n.delivered.Add(1)
	out, err := h.Handle(method, payload)
	if err != nil {
		time.Sleep(failWait)
		return false
	}

	time.Sleep(repDelay)
	if dropRep || e.cut() {
		time.Sleep(failWait)
		return false
	}
	if err := Decode(out, reply); err != nil {
		panic("labrpc: decode reply: " + err.Error())
	}
	return true
}

// cut reports whether the path is broken now (partition, crash, closed end).
func (e *ClientEnd) cut() bool {
	e.net.mu.Lock()
	defer e.net.mu.Unlock()
	return e.closed.Load() || !e.net.reachable(e.from, e.to)
}

// ErrDown is returned by handlers that are shutting down.
var ErrDown = errDown
