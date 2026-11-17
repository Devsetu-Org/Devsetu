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
	parts := splitOR(q)
	var groups [][]string
	for _, part := range parts {
		terms := analyze.Analyze(part)
		if len(terms) == 0 {
			continue
		}
		groups = append(groups, terms)
	}
	return Query{Groups: groups}
}

func splitOR(q string) []string {
	fields := strings.Fields(q)
	if len(fields) == 0 {
		return nil
	}
	var parts []string
	var cur []string
	flush := func() {
		if len(cur) > 0 {
			parts = append(parts, strings.Join(cur, " "))
			cur = nil
		}
	}
	for _, f := range fields {
		if f == "OR" {
			flush()
			continue
		}
		cur = append(cur, f)
	}
	flush()
	return parts
}
