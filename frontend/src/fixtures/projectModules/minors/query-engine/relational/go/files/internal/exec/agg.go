package exec

import "github.com/devlabs/sqlq/internal/parse"

// Aggregate groups rows and evaluates COUNT(*) and SUM.
func Aggregate(rows []Row, items []parse.SelectItem, group []parse.Expr) ([]Row, error) {
	// TODO(5.3): Bucket rows by the GROUP BY values. COUNT(*) is the bucket size.
	// SUM(expr) adds Eval(expr) for each row. No rows and no GROUP BY still yields one row of zeros.
	// Output names come from the alias, or from the call name when there is no alias.
	panic("TODO(5.3): Aggregate")
}
