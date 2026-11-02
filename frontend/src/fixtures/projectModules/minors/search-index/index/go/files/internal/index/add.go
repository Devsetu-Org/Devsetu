package index

import (
	"fmt"

	"github.com/devlabs/findx/internal/analyze"
)

// Add analyzes text, assigns a new internal doc id (or rejects a duplicate
// external id), records document length, and inserts (docID, tf) postings into
// the in-memory map. Add does not write disk; call Flush.
func (e *Engine) Add(id, text string) error {
	// TODO(3.1): Reject an empty id and a duplicate e.extToID[id].
	// tokens := analyze.Analyze(text). Count tf per term. Assign docID := e.nextDoc
	// and increment. Store Meta{ExtID: id, Len: len(tokens)} in e.docs, update
	// e.extToID and e.bufLens, then e.mem.Add(term, docID, tf) for each term.
	_ = analyze.Analyze
	_ = fmt.Errorf
	panic("TODO(3.1): Engine.Add")
}
