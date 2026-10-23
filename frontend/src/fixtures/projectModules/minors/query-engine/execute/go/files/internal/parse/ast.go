// Package parse builds a statement tree from tokens.
package parse

import "fmt"

// TypeName is a column type in CREATE TABLE.
type TypeName int

const (
	TypeInt TypeName = iota
	TypeText
)

func (t TypeName) String() string {
	if t == TypeText {
		return "TEXT"
	}
	return "INT"
}

// Stmt is one SQL statement.
type Stmt interface{ isStmt() }

// Column is one CREATE TABLE column.
type Column struct {
	Name string
	Type TypeName
}

// CreateTable is CREATE TABLE.
type CreateTable struct {
	Name string
	Cols []Column
}

func (*CreateTable) isStmt() {}

// Insert is INSERT INTO ... VALUES.
type Insert struct {
	Table string
	Rows  [][]Expr
}

func (*Insert) isStmt() {}

// Select is a SELECT statement. Join, Group, Order, and Limit stay nil until chapter 5 fills them.
type Select struct {
	Items []SelectItem
	From  string
	Alias string
	Where Expr
	Join  *Join
	Group []Expr
	Order []OrderKey
	Limit *int64
}

func (*Select) isStmt() {}

// Join is one INNER JOIN ... ON a = b.
type Join struct {
	Table string
	Alias string
	Left  Expr
	Right Expr
}

// SelectItem is one entry in the select list. Star is the bare `*`.
type SelectItem struct {
	Expr  Expr
	Alias string
	Star  bool
}

// OrderKey is one ORDER BY key.
type OrderKey struct {
	Expr Expr
	Desc bool
}

// Expr is a scalar expression.
type Expr interface{ isExpr() }

// Ident is a bare name.
type Ident struct{ Name string }

func (*Ident) isExpr() {}

// Qual is table.column.
type Qual struct{ Table, Name string }

func (*Qual) isExpr() {}

// IntLit is an integer literal.
type IntLit struct{ V int64 }

func (*IntLit) isExpr() {}

// StrLit is a string literal.
type StrLit struct{ V string }

func (*StrLit) isExpr() {}

// Binary is AND or a comparison. Op is "AND", "=", "<", or ">".
type Binary struct {
	Op   string
	L, R Expr
}

func (*Binary) isExpr() {}

// Call is COUNT(*) or SUM(expr). Star is set for COUNT(*).
type Call struct {
	Name string
	Arg  Expr
	Star bool
}

func (*Call) isExpr() {}

// Name is the display name of an expression, used as the output column name
// when the select item has no alias.
func Name(e Expr) string {
	switch v := e.(type) {
	case *Ident:
		return v.Name
	case *Qual:
		return v.Table + "." + v.Name
	case *IntLit:
		return fmt.Sprint(v.V)
	case *StrLit:
		return "'" + v.V + "'"
	case *Call:
		if v.Star {
			return "count(*)"
		}
		return v.Name + "(" + Name(v.Arg) + ")"
	case *Binary:
		return Name(v.L) + " " + v.Op + " " + Name(v.R)
	default:
		return "?"
	}
}
