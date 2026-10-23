// Package sqlq is a small SQL engine: CREATE, INSERT, and SELECT.
package sqlq

import (
	"fmt"
	"strings"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// DB is one in-memory database.
type DB struct {
	cat *catalog.DB
}

// Result is the table a SELECT produced.
type Result struct {
	Cols []string
	Rows [][]catalog.Value
}

// Open returns an empty database.
func Open() *DB { return &DB{cat: catalog.New()} }

// Exec runs CREATE TABLE or INSERT.
func (db *DB) Exec(sql string) error {
	stmt, err := parse.Parse(sql)
	if err != nil {
		return err
	}
	switch s := stmt.(type) {
	case *parse.CreateTable:
		cols := make([]catalog.Col, len(s.Cols))
		for i, c := range s.Cols {
			typ := catalog.TypeInt
			if c.Type == parse.TypeText {
				typ = catalog.TypeText
			}
			cols[i] = catalog.Col{Name: c.Name, Type: typ}
		}
		return db.cat.Create(s.Name, cols)
	case *parse.Insert:
		for _, row := range s.Rows {
			vals := make([]catalog.Value, len(row))
			for i, e := range row {
				v, err := literal(e)
				if err != nil {
					return err
				}
				vals[i] = v
			}
			if err := db.cat.Insert(s.Table, vals); err != nil {
				return err
			}
		}
		return nil
	default:
		return fmt.Errorf("EXEC does not run SELECT")
	}
}

// Query runs one SELECT. Scanning rows is the next chapter.
func (db *DB) Query(sql string) (*Result, error) {
	return nil, fmt.Errorf("SELECT runs in the next chapter")
}

func literal(e parse.Expr) (catalog.Value, error) {
	switch v := e.(type) {
	case *parse.IntLit:
		return catalog.Int(v.V), nil
	case *parse.StrLit:
		return catalog.Text(v.V), nil
	default:
		return catalog.Value{}, fmt.Errorf("INSERT values must be literals")
	}
}

// Format renders a result as aligned text.
func Format(res *Result) string {
	var b strings.Builder
	b.WriteString(strings.Join(res.Cols, "\t"))
	for _, row := range res.Rows {
		b.WriteByte('\n')
		for i, v := range row {
			if i > 0 {
				b.WriteByte('\t')
			}
			b.WriteString(v.String())
		}
	}
	return b.String()
}
