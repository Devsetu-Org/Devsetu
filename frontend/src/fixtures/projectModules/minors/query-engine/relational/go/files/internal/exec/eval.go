package exec

import (
	"fmt"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// Eval evaluates a scalar expression against one row. Aggregate calls are not scalar.
func Eval(e parse.Expr, row Row) (catalog.Value, error) {
	switch v := e.(type) {
	case *parse.IntLit:
		return catalog.Int(v.V), nil
	case *parse.StrLit:
		return catalog.Text(v.V), nil
	case *parse.Ident:
		val, ok := row.Get(v.Name)
		if !ok {
			return catalog.Value{}, fmt.Errorf("no column %s", v.Name)
		}
		return val, nil
	case *parse.Qual:
		val, ok := row.Get(v.Table + "." + v.Name)
		if !ok {
			val, ok = row.Get(v.Name)
		}
		if !ok {
			return catalog.Value{}, fmt.Errorf("no column %s.%s", v.Table, v.Name)
		}
		return val, nil
	case *parse.Binary:
		return evalBinary(v, row)
	case *parse.Call:
		return catalog.Value{}, fmt.Errorf("aggregate %s is not allowed here", v.Name)
	default:
		return catalog.Value{}, fmt.Errorf("bad expression")
	}
}

func evalBinary(v *parse.Binary, row Row) (catalog.Value, error) {
	l, err := Eval(v.L, row)
	if err != nil {
		return catalog.Value{}, err
	}
	if v.Op == "AND" {
		if l.T != catalog.TypeBool {
			return catalog.Value{}, fmt.Errorf("AND needs booleans")
		}
		if !l.B {
			return catalog.Bool(false), nil
		}
		r, err := Eval(v.R, row)
		if err != nil {
			return catalog.Value{}, err
		}
		if r.T != catalog.TypeBool {
			return catalog.Value{}, fmt.Errorf("AND needs booleans")
		}
		return catalog.Bool(r.B), nil
	}
	r, err := Eval(v.R, row)
	if err != nil {
		return catalog.Value{}, err
	}
	if l.T != r.T || (l.T != catalog.TypeInt && l.T != catalog.TypeText) {
		return catalog.Value{}, fmt.Errorf("cannot compare those types")
	}
	var cmp int
	if l.T == catalog.TypeInt {
		switch {
		case l.I < r.I:
			cmp = -1
		case l.I > r.I:
			cmp = 1
		}
	} else {
		switch {
		case l.S < r.S:
			cmp = -1
		case l.S > r.S:
			cmp = 1
		}
	}
	var ok bool
	switch v.Op {
	case "=":
		ok = cmp == 0
	case "<":
		ok = cmp < 0
	case ">":
		ok = cmp > 0
	default:
		return catalog.Value{}, fmt.Errorf("bad operator %s", v.Op)
	}
	return catalog.Bool(ok), nil
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
