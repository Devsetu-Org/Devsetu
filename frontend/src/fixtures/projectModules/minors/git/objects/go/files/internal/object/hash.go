package object

import (
	"encoding/hex"
	"fmt"
)

// Hash is a SHA-1 object id (20 bytes).
type Hash [20]byte

// Zero is the all-zero hash.
var Zero Hash

// HashOf returns the SHA-1 of data.
func HashOf(data []byte) Hash {
	// TODO(1.1): sha1.Sum(data), copy into Hash, return it.
	// Import crypto/sha1.
	panic("TODO(1.1): HashOf")
}

// Hex returns the 40-character lowercase hex encoding.
func (h Hash) Hex() string {
	return hex.EncodeToString(h[:])
}

func (h Hash) String() string { return h.Hex() }

// IsZero reports whether h is all zeros.
func (h Hash) IsZero() bool { return h == Zero }

// ParseHex parses a 40-character hex object id.
func ParseHex(s string) (Hash, error) {
	var h Hash
	if len(s) != 40 {
		return h, fmt.Errorf("object: bad hash length %d", len(s))
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return h, fmt.Errorf("object: bad hash: %w", err)
	}
	copy(h[:], b)
	return h, nil
}
