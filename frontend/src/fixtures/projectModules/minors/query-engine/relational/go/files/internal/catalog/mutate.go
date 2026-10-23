package catalog

import "fmt"

// Create adds a table. The name must be new, and column names must be unique.
func (db *DB) Create(name string, cols []Col) error {
	if name == "" {
		return fmt.Errorf("empty table name")
	}
	if len(cols) == 0 {
		return fmt.Errorf("table %s has no columns", name)
	}
	if _, ok := db.tables[name]; ok {
		return fmt.Errorf("table %s already exists", name)
	}
	seen := map[string]bool{}
	for _, c := range cols {
		if c.Name == "" || seen[c.Name] {
			return fmt.Errorf("bad column %q", c.Name)
		}
		seen[c.Name] = true
	}
	copied := append([]Col(nil), cols...)
	db.tables[name] = &Table{Name: name, Cols: copied}
	return nil
}

// Insert appends one row. The width and the cell types must match the table.
func (db *DB) Insert(name string, row []Value) error {
	t, err := db.Lookup(name)
	if err != nil {
		return err
	}
	if len(row) != len(t.Cols) {
		return fmt.Errorf("table %s wants %d values", name, len(t.Cols))
	}
	for i, c := range t.Cols {
		if row[i].T != c.Type {
			return fmt.Errorf("column %s wants %s", c.Name, typeName(c.Type))
		}
	}
	t.Rows = append(t.Rows, append([]Value(nil), row...))
	return nil
}

func typeName(t Type) string {
	if t == TypeText {
		return "TEXT"
	}
	return "INT"
}
