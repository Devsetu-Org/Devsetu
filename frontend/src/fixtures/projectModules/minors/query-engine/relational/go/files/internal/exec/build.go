package exec

import (
	"fmt"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// RunSelect executes one SELECT.
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
	if sel.Join != nil {
		right, err := db.Lookup(sel.Join.Table)
		if err != nil {
			return nil, err
		}
		rq := sel.Join.Table
		if sel.Join.Alias != "" {
			rq = sel.Join.Alias
		}
		rightRows, err := ReadAll(NewScan(right, rq))
		if err != nil {
			return nil, err
		}
		it = NewNestedLoop(it, rightRows, sel.Join.Left, sel.Join.Right)
	}
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
	if HasAggregate(sel) {
		rows, err = Aggregate(rows, sel.Items, sel.Group)
		if err != nil {
			return nil, err
		}
	} else {
		proj := &Project{Child: &sliceIter{rows: rows}, Pick: func(row Row) (Row, error) {
			return project(sel.Items, row)
		}}
		rows, err = ReadAll(proj)
		if err != nil {
			return nil, err
		}
	}
	if len(sel.Order) > 0 {
		if err := SortRows(rows, sel.Order); err != nil {
			return nil, err
		}
	}
	if sel.Limit != nil {
		rows = LimitRows(rows, int(*sel.Limit))
	}
	return rows, nil
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

// HasAggregate reports whether the select list or GROUP BY needs aggregation.
func HasAggregate(sel *parse.Select) bool {
	if len(sel.Group) > 0 {
		return true
	}
	for _, item := range sel.Items {
		if _, ok := item.Expr.(*parse.Call); ok {
			return true
		}
	}
	return false
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
