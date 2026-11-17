package index

import (
	"fmt"

	"github.com/devlabs/findx/internal/analyze"
)

// Add analyzes text, assigns a new internal doc id (or rejects a duplicate
// external id), records document length, and inserts (docID, tf) postings into
// the in-memory map. Add does not write disk; call Flush.
func (e *Engine) Add(id, text string) error {
	// TODO(3.1)
	_ = analyze.Analyze
	_ = fmt.Errorf
	panic("TODO(3.1)")
}
