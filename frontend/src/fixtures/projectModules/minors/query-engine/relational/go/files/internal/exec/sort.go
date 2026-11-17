package exec

import "github.com/devlabs/sqlq/internal/parse"

// SortRows orders rows by the output column named by each key.
func SortRows(rows []Row, keys []parse.OrderKey) error {
	// TODO(5.4) — SortRows
	panic("TODO(5.4)")
}

// LimitRows keeps at most n rows. A negative n keeps every row.
func LimitRows(rows []Row, n int) []Row {
	if n < 0 || n >= len(rows) {
		return rows
	}
	return rows[:n]
}
