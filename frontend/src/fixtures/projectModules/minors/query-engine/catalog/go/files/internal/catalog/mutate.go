package catalog

// Create adds a table. The name must be new, and column names must be unique.
func (db *DB) Create(name string, cols []Col) error {
	// TODO(3.2) — Create
	panic("TODO(3.2)")
}

// Insert appends one row. The width and the cell types must match the table.
func (db *DB) Insert(name string, row []Value) error {
	// TODO(3.3) — Insert
	panic("TODO(3.3)")
}
