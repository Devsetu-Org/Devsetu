package query

import (
	"strings"

	"github.com/devlabs/findx/internal/analyze"
)

// Query is a boolean retrieval request. Groups are OR'd; terms inside a group
// are AND'd. "cat dog" → one group [cat, dog]. "cat OR dog" → two groups.
type Query struct {
	Groups [][]string
}

// Parse analyzes a query string. The literal token OR (ASCII, surrounded by
// whitespace when between terms) splits OR-groups. Each group is analyzed with
// the same analyzer as documents; empty groups after analysis are dropped.
func Parse(q string) Query {
	// TODO(4.1): Split q on whitespace into fields. Treat a field equal to "OR"
	// as a group separator (not analyzed). Join each group's fields with spaces,
	// run analyze.Analyze, skip empty results, and return Query{Groups: ...}.
	_ = strings.Fields
	_ = analyze.Analyze
	panic("TODO(4.1): Parse")
}
