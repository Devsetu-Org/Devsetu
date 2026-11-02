package postings

import "sort"

// Map is an in-memory inverted index: term → postings sorted by DocID.
type Map struct {
	terms map[string][]Posting
}

// NewMap returns an empty posting map.
func NewMap() *Map {
	return &Map{terms: make(map[string][]Posting)}
}

// Add records that term appears in docID with frequency tf. If the term already
// has an entry for docID, TF is replaced (not summed). Lists stay sorted by DocID.
func (m *Map) Add(term string, docID, tf uint32) {
	// TODO(2.1): Ensure m.terms is non-nil. Find the insertion point with
	// sort.Search on DocID. If docID is present, replace TF. Otherwise insert
	// Posting{DocID: docID, TF: tf} so the slice stays sorted by DocID.
	_ = sort.Search
	panic("TODO(2.1): Map.Add")
}

// Terms returns a sorted list of term strings.
func (m *Map) Terms() []string {
	out := make([]string, 0, len(m.terms))
	for t := range m.terms {
		out = append(out, t)
	}
	sort.Strings(out)
	return out
}

// Postings returns the list for term, or nil if absent.
func (m *Map) Postings(term string) []Posting {
	return m.terms[term]
}

// Clear removes every term.
func (m *Map) Clear() {
	m.terms = make(map[string][]Posting)
}
