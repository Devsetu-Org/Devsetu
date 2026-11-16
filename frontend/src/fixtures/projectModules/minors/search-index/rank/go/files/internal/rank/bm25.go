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
	// TODO(5.2)
	_ = math.Log
	panic("TODO(5.2)")
}

// Score returns the BM25 contribution of one term for one document.
// tf is the term frequency in the document, dl is the document length,
// df is the document frequency of the term.
func Score(tf, dl, df int, st Stats) float64 {
	// TODO(5.2)
	panic("TODO(5.2)")
}
