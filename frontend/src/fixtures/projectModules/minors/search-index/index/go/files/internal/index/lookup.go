package index

import (
	"sort"

	"github.com/devlabs/findx/internal/postings"
)

// Postings merges the term's posting lists from every flushed segment plus the
// in-memory buffer, sorted by DocID. Duplicate doc ids across segments are not
// expected in this minor (a doc is flushed once).
func (e *Engine) Postings(term string) []postings.Posting {
	var out []postings.Posting
	for _, seg := range e.segs {
		if list, ok := seg.Postings(term); ok {
			out = append(out, list...)
		}
	}
	if list := e.mem.Postings(term); len(list) > 0 {
		out = append(out, list...)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DocID < out[j].DocID })
	return out
}

// Doc returns catalog metadata for an internal id.
func (e *Engine) Doc(id uint32) (Meta, bool) {
	m, ok := e.docs[id]
	return m, ok
}

// NumDocs is the number of indexed documents (flushed or buffered).
func (e *Engine) NumDocs() int {
	return len(e.docs)
}

// AvgDL is the average document length over the catalog.
func (e *Engine) AvgDL() float64 {
	if len(e.docs) == 0 {
		return 0
	}
	sum := 0
	for _, m := range e.docs {
		sum += m.Len
	}
	return float64(sum) / float64(len(e.docs))
}

// DF is the document frequency of term across segments and the memory buffer.
func (e *Engine) DF(term string) int {
	return len(e.Postings(term))
}

// ExtID maps an internal doc id to the caller's string id.
func (e *Engine) ExtID(id uint32) string {
	return e.docs[id].ExtID
}
