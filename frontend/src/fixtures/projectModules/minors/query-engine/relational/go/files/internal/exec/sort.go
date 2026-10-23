package exec

import "github.com/devlabs/sqlq/internal/parse"

// SortRows orders rows by the output column named by each key.
func SortRows(rows []Row, keys []parse.OrderKey) error {
	// TODO(5.4): Each key names an output column (parse.Name, or the ident). Stable sort.
	// Desc flips the comparison. A missing name is an error when there is at least one row.
	panic("TODO(5.4): SortRows")
}

// LimitRows keeps at most n rows. A negative n keeps every row.
func LimitRows(rows []Row, n int) []Row {
	if n < 0 || n >= len(rows) {
		return rows
	}
	return rows[:n]
}
