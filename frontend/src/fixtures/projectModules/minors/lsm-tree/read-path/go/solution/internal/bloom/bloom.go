// Package bloom builds and queries Bloom filters: compact bit arrays that
// answer "definitely not here" or "maybe here" for a key.
package bloom

// Filter layout: the bit array, then one byte holding k, the number of probes.
//
//	┌────────────────────────────┬─────┐
//	│ bits (m = 8 * len-1)       │  k  │
//	└────────────────────────────┴─────┘
//
// Bit i lives in byte i/8, at position i%8 (least significant first).

const (
	minBits   = 64
	maxProbes = 30
)

// Builder collects keys for one filter.
type Builder struct {
	bitsPerKey int
	hashes     []uint64
}

// NewBuilder returns a builder that spends about bitsPerKey bits per key.
// 10 bits per key gives roughly a 1% false-positive rate.
func NewBuilder(bitsPerKey int) *Builder {
	if bitsPerKey < 1 {
		bitsPerKey = 1
	}
	return &Builder{bitsPerKey: bitsPerKey}
}

// Add records key. Only its hash is kept.
func (b *Builder) Add(key []byte) {
	b.hashes = append(b.hashes, hash(key))
}

// numProbes is the k that minimizes false positives for a given bits per
// key: k = bitsPerKey * ln 2.
func numProbes(bitsPerKey int) int {
	k := int(float64(bitsPerKey) * 0.69)
	if k < 1 {
		k = 1
	}
	if k > maxProbes {
		k = maxProbes
	}
	return k
}

// probe returns the i-th bit position for a key's hash in an m-bit array.
//
// Instead of k independent hash functions, it derives k positions from two
// halves of one 64-bit hash (Kirsch and Mitzenmacher, 2006): h1 + i*h2.
func probe(h uint64, i, m uint32) uint32 {
	h1, h2 := uint32(h), uint32(h>>32)
	return (h1 + i*h2) % m
}

// Finish returns the encoded filter for every key added so far.
func (b *Builder) Finish() []byte {
	nBits := len(b.hashes) * b.bitsPerKey
	if nBits < minBits {
		nBits = minBits
	}
	nBytes := (nBits + 7) / 8
	m := uint32(nBytes * 8)
	k := numProbes(b.bitsPerKey)

	filter := make([]byte, nBytes+1)
	filter[nBytes] = byte(k)
	for _, h := range b.hashes {
		for i := 0; i < k; i++ {
			bit := probe(h, uint32(i), m)
			filter[bit/8] |= 1 << (bit % 8)
		}
	}
	return filter
}

// MayContain reports whether key may have been added to filter. False means
// it definitely was not. A filter that does not decode answers true: when in
// doubt, read the table.
func MayContain(filter, key []byte) bool {
	if len(filter) < 2 {
		return true
	}
	k := int(filter[len(filter)-1])
	if k < 1 || k > maxProbes {
		return true
	}
	m := uint32((len(filter) - 1) * 8)
	h := hash(key)
	for i := 0; i < k; i++ {
		bit := probe(h, uint32(i), m)
		if filter[bit/8]&(1<<(bit%8)) == 0 {
			return false
		}
	}
	return true
}

// hash is 64-bit FNV-1a followed by a finalizer that spreads similar keys
// ("order:1", "order:2") across all 64 bits.
func hash(key []byte) uint64 {
	h := uint64(14695981039346656037)
	for _, c := range key {
		h ^= uint64(c)
		h *= 1099511628211
	}
	h ^= h >> 33
	h *= 0xff51afd7ed558ccd
	h ^= h >> 33
	h *= 0xc4ceb9fe1a85ec53
	h ^= h >> 33
	return h
}
