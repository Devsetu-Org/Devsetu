package storage

import "sync"

// Mem is a Store that lives in memory. A test harness keeps the Mem when it
// "crashes" a node and hands it to the restarted one, which is what the disk
// would have done.
type Mem struct {
	mu    sync.Mutex
	state []byte
	saves int
}

// NewMem returns an empty Mem.
func NewMem() *Mem { return &Mem{} }

// Save implements Store.
func (m *Mem) Save(state []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state = append(m.state[:0:0], state...)
	m.saves++
	return nil
}

// Load implements Store.
func (m *Mem) Load() ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.state == nil {
		return nil, nil
	}
	return append([]byte(nil), m.state...), nil
}

// Saves is how many times Save was called.
func (m *Mem) Saves() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.saves
}
