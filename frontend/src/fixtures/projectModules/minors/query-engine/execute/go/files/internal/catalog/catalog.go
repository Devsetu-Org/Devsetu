// Package catalog stores tables in memory.
package catalog

import "fmt"

// Type is a column type.
type Type int

const (
	TypeInt Type = iota
	TypeText
	TypeBool
)

// Value is one cell.
type Value struct {
	T Type
	I int64
	S string
	B bool
}

func Int(n int64) Value   { return Value{T: TypeInt, I: n} }
func Text(s string) Value { return Value{T: TypeText, S: s} }
func Bool(b bool) Value   { return Value{T: TypeBool, B: b} }

func (v Value) String() string {
	switch v.T {
	case TypeInt:
		return fmt.Sprint(v.I)
	case TypeText:
		return v.S
	case TypeBool:
		if v.B {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

// Col is one column of a table.
type Col struct {
	Name string
	Type Type
}

// Table is one created table and its rows, in insert order.
type Table struct {
	Name string
	Cols []Col
	Rows [][]Value
}

// DB is the in-memory catalog.
type DB struct {
	tables map[string]*Table
}

// New returns an empty catalog.
func New() *DB { return &DB{tables: map[string]*Table{}} }

// Lookup returns a table by name.
func (db *DB) Lookup(name string) (*Table, error) {
	t, ok := db.tables[name]
	if !ok {
		return nil, fmt.Errorf("no such table %s", name)
	}
	return t, nil
}
