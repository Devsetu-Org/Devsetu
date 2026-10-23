package exec

import "github.com/devlabs/sqlq/internal/parse"

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
	// TODO(5.2): For each left row, try every right row. Concatenate the columns.
	// Keep the pair when Eval(OnL) and Eval(OnR) have the same type and the same value.
	panic("TODO(5.2): NestedLoop.Next")
}
