// Package exec runs a parsed statement against the catalog.
package exec

import "github.com/devlabs/sqlq/internal/catalog"

// Row is one tuple. Cols[i] names Vals[i].
type Row struct {
	Cols []string
	Vals []catalog.Value
}

// Get finds a column by its exact name, or by an unqualified name when that
// suffix is unique.
func (r Row) Get(name string) (catalog.Value, bool) {
	for i, c := range r.Cols {
		if c == name {
			return r.Vals[i], true
		}
	}
	found := -1
	for i, c := range r.Cols {
		dot := -1
		for j := 0; j < len(c); j++ {
			if c[j] == '.' {
				dot = j
			}
		}
		if dot >= 0 && c[dot+1:] == name {
			if found >= 0 {
				return catalog.Value{}, false
			}
			found = i
		}
	}
	if found < 0 {
		return catalog.Value{}, false
	}
	return r.Vals[found], true
}

// ReadAll drains it.
func ReadAll(it Iter) ([]Row, error) {
	var out []Row
	for {
		row, ok, err := it.Next()
		if err != nil {
			return nil, err
		}
		if !ok {
			return out, nil
		}
		out = append(out, row)
	}
}

// Iter yields rows.
type Iter interface {
	Next() (Row, bool, error)
}

// Scan walks one table. Qualifier prefixes each column name.
type Scan struct {
	Cols []string
	Rows [][]catalog.Value
	i    int
}

// NewScan builds a scan of t. qualifier is the table name or its alias.
func NewScan(t *catalog.Table, qualifier string) *Scan {
	cols := make([]string, len(t.Cols))
	for i, c := range t.Cols {
		cols[i] = qualifier + "." + c.Name
	}
	rows := make([][]catalog.Value, len(t.Rows))
	for i, row := range t.Rows {
		rows[i] = append([]catalog.Value(nil), row...)
	}
	return &Scan{Cols: cols, Rows: rows}
}

// Filter keeps rows for which Pred is true.
type Filter struct {
	Child Iter
	Pred  func(Row) (bool, error)
}

// Project keeps a subset of columns, possibly renamed.
type Project struct {
	Child Iter
	Names []string
	Pick  func(Row) (Row, error)
}
