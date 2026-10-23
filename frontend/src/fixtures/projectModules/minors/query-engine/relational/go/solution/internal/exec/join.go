package exec

import (
	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// NestedLoop pairs every left row with every right row and keeps pairs whose ON values are equal.
type NestedLoop struct {
	Left   Iter
	Right  []Row
	OnL    parse.Expr
	OnR    parse.Expr
	cur    Row
	rj     int
	primed bool
}

// NewNestedLoop builds a join. right is the fully read right-hand side.
func NewNestedLoop(left Iter, right []Row, onL, onR parse.Expr) *NestedLoop {
	return &NestedLoop{Left: left, Right: right, OnL: onL, OnR: onR}
}

// Next returns the next joined row.
func (n *NestedLoop) Next() (Row, bool, error) {
	for {
		if !n.primed || n.rj >= len(n.Right) {
			row, ok, err := n.Left.Next()
			if err != nil || !ok {
				return Row{}, ok, err
			}
			n.cur = row
			n.rj = 0
			n.primed = true
		}
		if n.rj >= len(n.Right) {
			continue
		}
		right := n.Right[n.rj]
		n.rj++
		joined := concat(n.cur, right)
		lv, err := Eval(n.OnL, joined)
		if err != nil {
			return Row{}, false, err
		}
		rv, err := Eval(n.OnR, joined)
		if err != nil {
			return Row{}, false, err
		}
		if lv.T == rv.T && valuesEqual(lv, rv) {
			return joined, true, nil
		}
	}
}

func concat(a, b Row) Row {
	cols := append(append([]string{}, a.Cols...), b.Cols...)
	vals := append(append([]catalog.Value{}, a.Vals...), b.Vals...)
	return Row{Cols: cols, Vals: vals}
}

func valuesEqual(a, b catalog.Value) bool {
	if a.T != b.T {
		return false
	}
	switch a.T {
	case catalog.TypeInt:
		return a.I == b.I
	case catalog.TypeText:
		return a.S == b.S
	default:
		return a.B == b.B
	}
}
