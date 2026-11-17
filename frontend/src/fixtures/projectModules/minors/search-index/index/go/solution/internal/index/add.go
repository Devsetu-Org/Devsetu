package index

import (
	"fmt"

	"github.com/devlabs/findx/internal/analyze"
)

// Add analyzes text, assigns a new internal doc id (or rejects a duplicate
// external id), records document length, and inserts (docID, tf) postings into
// the in-memory map. Add does not write disk; call Flush.
func (e *Engine) Add(id, text string) error {
	if id == "" {
		return fmt.Errorf("empty document id")
	}
	if _, exists := e.extToID[id]; exists {
		return fmt.Errorf("duplicate document id %q", id)
	}
	tokens := analyze.Analyze(text)
	tf := make(map[string]uint32)
	for _, t := range tokens {
		tf[t]++
	}
	docID := e.nextDoc
	e.nextDoc++
	e.docs[docID] = Meta{ExtID: id, Len: len(tokens)}
	e.extToID[id] = docID
	e.bufLens[docID] = len(tokens)
	for term, n := range tf {
		e.mem.Add(term, docID, n)
	}
	return nil
}
