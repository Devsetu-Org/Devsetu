package rank

import "sort"

// Hit is one ranked result.
type Hit struct {
	DocID uint32
	Score float64
}

// TopK sorts hits by descending score, breaking ties by ascending DocID, and
// returns at most k results. k <= 0 means all hits.
func TopK(hits []Hit, k int) []Hit {
	// TODO(5.3)
	_ = sort.SliceStable
	panic("TODO(5.3)")
}
