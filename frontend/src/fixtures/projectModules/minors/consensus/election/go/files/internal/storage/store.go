// Package storage is where a node keeps what must survive a crash.
//
// A Store holds one opaque blob, the node's whole persistent state. Save
// replaces it atomically; Load returns the last saved blob, or nil when
// nothing was ever saved.
package storage

// Store is durable storage for one node.
type Store interface {
	// Save durably replaces the stored state. When Save returns nil the data
	// survives a crash; a crash during Save leaves the old state or the new
	// state, never a mix.
	Save(state []byte) error
	// Load returns the last saved state, or nil if none exists.
	Load() ([]byte, error)
}
