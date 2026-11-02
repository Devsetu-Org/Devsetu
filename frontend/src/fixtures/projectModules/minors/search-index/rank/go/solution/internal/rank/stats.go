package rank

// DocFreq is anything that can report document frequency for a term.
type DocFreq interface {
	NumDocs() int
	AvgDL() float64
	DF(term string) int
}

// CollectStats builds collection Stats and a per-term DF map for terms.
func CollectStats(src DocFreq, terms []string) (Stats, map[string]int) {
	st := Stats{N: src.NumDocs(), AvgDL: src.AvgDL()}
	df := make(map[string]int, len(terms))
	for _, t := range terms {
		if _, ok := df[t]; ok {
			continue
		}
		df[t] = src.DF(t)
	}
	return st, df
}
