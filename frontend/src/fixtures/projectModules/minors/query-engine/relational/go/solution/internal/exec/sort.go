package exec

import (
	"fmt"
	"sort"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// SortRows orders rows by the output column named by each key.
func SortRows(rows []Row, keys []parse.OrderKey) error {
	idx := make([]int, len(keys))
	desc := make([]bool, len(keys))
	for i, k := range keys {
		name := parse.Name(k.Expr)
		if id, ok := k.Expr.(*parse.Ident); ok {
			name = id.Name
		}
		found := -1
		if len(rows) > 0 {
			for c, col := range rows[0].Cols {
				if col == name || col == parse.Name(k.Expr) {
					found = c
					break
				}
			}
		}
		if found < 0 && len(rows) > 0 {
			return fmt.Errorf("ORDER BY %s is not an output column", name)
		}
		idx[i] = found
		desc[i] = k.Desc
	}
	sort.SliceStable(rows, func(a, b int) bool {
		for i := range idx {
			if idx[i] < 0 {
				continue
			}
			cmp := compareVal(rows[a].Vals[idx[i]], rows[b].Vals[idx[i]])
			if cmp == 0 {
				continue
			}
			if desc[i] {
				return cmp > 0
			}
			return cmp < 0
		}
		return false
	})
	return nil
}

func compareVal(a, b catalog.Value) int {
	switch a.T {
	case catalog.TypeInt:
		switch {
		case a.I < b.I:
			return -1
		case a.I > b.I:
			return 1
		}
	case catalog.TypeText:
		switch {
		case a.S < b.S:
			return -1
		case a.S > b.S:
			return 1
		}
	}
	return 0
}

// LimitRows keeps at most n rows. A negative n keeps every row.
func LimitRows(rows []Row, n int) []Row {
	if n < 0 || n >= len(rows) {
		return rows
	}
	return rows[:n]
}
