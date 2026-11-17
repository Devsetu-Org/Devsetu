package exec

import "github.com/devlabs/sqlq/internal/parse"

// Aggregate groups rows and evaluates COUNT(*) and SUM.
func Aggregate(rows []Row, items []parse.SelectItem, group []parse.Expr) ([]Row, error) {
	// TODO(5.3) — Aggregate
	panic("TODO(5.3)")
}
