package exec

import (
	"fmt"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// RunSelect executes a single-table SELECT: scan, optional WHERE, then projection.
func RunSelect(db *catalog.DB, sel *parse.Select) ([]Row, error) {
	left, err := db.Lookup(sel.From)
	if err != nil {
		return nil, err
	}
	qual := sel.From
	if sel.Alias != "" {
		qual = sel.Alias
	}
	var it Iter = NewScan(left, qual)
	if sel.Where != nil {
		pred := sel.Where
		it = &Filter{Child: it, Pred: func(row Row) (bool, error) {
			return Truth(pred, row)
		}}
	}
	rows, err := ReadAll(it)
	if err != nil {
		return nil, err
	}
	proj := &Project{Child: &sliceIter{rows: rows}, Pick: func(row Row) (Row, error) {
		return project(sel.Items, row)
	}}
	return ReadAll(proj)
}

func project(items []parse.SelectItem, row Row) (Row, error) {
	out := Row{}
	for _, item := range items {
		if item.Star {
			out.Cols = append(out.Cols, row.Cols...)
			out.Vals = append(out.Vals, row.Vals...)
			continue
		}
		v, err := Eval(item.Expr, row)
		if err != nil {
			return Row{}, err
		}
		name := item.Alias
		if name == "" {
			name = parse.Name(item.Expr)
		}
		out.Cols = append(out.Cols, name)
		out.Vals = append(out.Vals, v)
	}
	if len(out.Cols) == 0 {
		return Row{}, fmt.Errorf("empty select list")
	}
	return out, nil
}

type sliceIter struct {
	rows []Row
	i    int
}

func (s *sliceIter) Next() (Row, bool, error) {
	if s.i >= len(s.rows) {
		return Row{}, false, nil
	}
	row := s.rows[s.i]
	s.i++
	return row, true, nil
}
