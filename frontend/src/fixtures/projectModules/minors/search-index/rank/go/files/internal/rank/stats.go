package rank

// DocFreq is anything that can report document frequency for a term.
type DocFreq interface {
	NumDocs() int
	AvgDL() float64
	DF(term string) int
}

// CollectStats builds collection Stats and a per-term DF map for terms.
func CollectStats(src DocFreq, terms []string) (Stats, map[string]int) {
	// TODO(5.1): Stats{N: src.NumDocs(), AvgDL: src.AvgDL()}. For each distinct
	// term, df[term] = src.DF(term). Return stats and the map.
	panic("TODO(5.1): CollectStats")
}
