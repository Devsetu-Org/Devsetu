package storage

import "sync"

// Fenced wraps a Store so a crashed node's leftover goroutines cannot write.
// After Fence, Save silently does nothing, as if the process were gone. The
// harness fences the old instance, then gives the restarted node a new Fenced
// over the same underlying Store.
type Fenced struct {
	mu     sync.Mutex
	inner  Store
	fenced bool
}

// NewFenced wraps inner.
func NewFenced(inner Store) *Fenced { return &Fenced{inner: inner} }

// Fence stops all later Saves. A Save already in progress finishes first.
func (f *Fenced) Fence() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.fenced = true
}

// Save implements Store.
func (f *Fenced) Save(state []byte) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fenced {
		return nil
	}
	return f.inner.Save(state)
}

// Load implements Store.
func (f *Fenced) Load() ([]byte, error) { return f.inner.Load() }
