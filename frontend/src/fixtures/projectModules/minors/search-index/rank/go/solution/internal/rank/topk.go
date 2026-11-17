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
	out := append([]Hit(nil), hits...)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].DocID < out[j].DocID
	})
	if k > 0 && len(out) > k {
		out = out[:k]
	}
	return out
}
