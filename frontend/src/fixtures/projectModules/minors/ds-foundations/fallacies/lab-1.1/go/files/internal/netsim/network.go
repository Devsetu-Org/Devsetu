// Package netsim is an in-process RPC network that drops and delays messages.
//
// There are no sockets. A Call encodes args, optionally drops the request,
// sleeps for a sampled delay, runs the handler, optionally drops the reply,
// and decodes into reply. Seeded randomness makes runs repeatable.
package netsim

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// Handler serves one RPC method. args is a concrete value (gob-decoded).
type Handler func(args any) (any, error)

// Network routes named methods to handlers with loss and delay.
type Network struct {
	mu       sync.Mutex
	rng      *rand.Rand
	handlers map[string]Handler
	loss     float64
	minDelay time.Duration
	maxDelay time.Duration
}

// New returns a reliable, zero-delay network. seed controls drops and delays.
func New(seed int64) *Network {
	return &Network{
		rng:      rand.New(rand.NewSource(seed)),
		handlers: map[string]Handler{},
	}
}

// Register attaches a handler for method (e.g. "Dispatch.TripHop").
func (n *Network) Register(method string, h Handler) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.handlers[method] = h
}

// SetLoss drops each direction (request or reply) independently with probability p.
// p=0 is reliable; p=1 drops everything.
func (n *Network) SetLoss(p float64) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if p < 0 {
		p = 0
	}
	if p > 1 {
		p = 1
	}
	n.loss = p
}

// SetDelay sets a uniform one-way delay in [min, max] applied before the handler runs.
func (n *Network) SetDelay(min, max time.Duration) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if max < min {
		min, max = max, min
	}
	n.minDelay, n.maxDelay = min, max
}

// Call invokes method with args and fills reply on success.
// Returns false if the request or reply was dropped, or if no handler exists.
func (n *Network) Call(method string, args, reply any) bool {
	n.mu.Lock()
	h, ok := n.handlers[method]
	dropReq := n.rollLocked(n.loss)
	dropRep := n.rollLocked(n.loss)
	delay := n.sampleDelayLocked()
	n.mu.Unlock()

	if !ok {
		return false
	}
	if dropReq {
		return false
	}
	if delay > 0 {
		time.Sleep(delay)
	}

	// Encode/decode so caller and handler never share memory — like a real RPC.
	payload, err := encode(args)
	if err != nil {
		return false
	}
	decoded, err := decodeAny(payload)
	if err != nil {
		return false
	}

	out, err := h(decoded)
	if err != nil {
		return false
	}
	if dropRep {
		return false
	}

	raw, err := encode(out)
	if err != nil {
		return false
	}
	return copyReply(raw, reply) == nil
}

func (n *Network) rollLocked(p float64) bool {
	return p > 0 && n.rng.Float64() < p
}

func (n *Network) sampleDelayLocked() time.Duration {
	if n.maxDelay <= 0 {
		return 0
	}
	span := n.maxDelay - n.minDelay
	if span <= 0 {
		return n.minDelay
	}
	return n.minDelay + time.Duration(n.rng.Int63n(int64(span)+1))
}

func encode(v any) ([]byte, error) {
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(&v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func decodeAny(data []byte) (any, error) {
	var v any
	if err := gob.NewDecoder(bytes.NewReader(data)).Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}

func copyReply(data []byte, reply any) error {
	if reply == nil {
		return fmt.Errorf("nil reply")
	}
	var v any
	if err := gob.NewDecoder(bytes.NewReader(data)).Decode(&v); err != nil {
		return err
	}
	// Re-encode concrete value into the caller's typed reply pointer.
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(v); err != nil {
		return err
	}
	return gob.NewDecoder(bytes.NewReader(buf.Bytes())).Decode(reply)
}
