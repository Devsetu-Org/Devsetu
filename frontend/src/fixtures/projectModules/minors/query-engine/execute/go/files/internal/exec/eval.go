package exec

import (
	"fmt"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// Eval evaluates a scalar expression against one row. Aggregate calls are not scalar.
func Eval(e parse.Expr, row Row) (catalog.Value, error) {
	// TODO(4.2): IntLit, StrLit, Ident and Qual via row.Get, Binary for AND and = < >.
	// AND is short-circuit. Comparisons require matching types and return catalog.Bool.
	// A Call is an error here; aggregates are a later chapter.
	panic("TODO(4.2): Eval")
}

// Truth reports whether a predicate holds.
func Truth(e parse.Expr, row Row) (bool, error) {
	v, err := Eval(e, row)
	if err != nil {
		return false, err
	}
	if v.T != catalog.TypeBool {
		return false, fmt.Errorf("WHERE must be a comparison")
	}
	return v.B, nil
}
