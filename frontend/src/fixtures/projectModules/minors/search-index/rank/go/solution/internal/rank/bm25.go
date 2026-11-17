package rank

import "math"

// BM25 parameters fixed for the minor (Elasticsearch / Lucene defaults).
const (
	K1 = 1.2
	B  = 0.75
)

// Stats are collection-wide numbers used by BM25.
type Stats struct {
	N     int     // number of documents
	AvgDL float64 // average document length
}

// IDF is the BM25+ style idf: ln(1 + (N - df + 0.5) / (df + 0.5)).
func IDF(n, df int) float64 {
	if n == 0 || df < 0 {
		return 0
	}
	return math.Log(1 + (float64(n)-float64(df)+0.5)/(float64(df)+0.5))
}

// Score returns the BM25 contribution of one term for one document.
// tf is the term frequency in the document, dl is the document length,
// df is the document frequency of the term.
func Score(tf, dl, df int, st Stats) float64 {
	if tf <= 0 || st.N == 0 || st.AvgDL == 0 {
		return 0
	}
	idf := IDF(st.N, df)
	tfComp := (float64(tf) * (K1 + 1)) /
		(float64(tf) + K1*(1-B+B*float64(dl)/st.AvgDL))
	return idf * tfComp
}
