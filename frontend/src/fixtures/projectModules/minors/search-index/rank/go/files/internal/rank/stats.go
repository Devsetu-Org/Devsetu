package rank

// DocFreq is anything that can report document frequency for a term.
type DocFreq interface {
	NumDocs() int
	AvgDL() float64
	DF(term string) int
}

// CollectStats builds collection Stats and a per-term DF map for terms.
func CollectStats(src DocFreq, terms []string) (Stats, map[string]int) {
	// TODO(5.1)
	panic("TODO(5.1)")
}
