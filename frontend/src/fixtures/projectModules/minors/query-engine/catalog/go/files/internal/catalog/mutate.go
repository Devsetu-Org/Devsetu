package catalog

// Create adds a table. The name must be new, and column names must be unique.
func (db *DB) Create(name string, cols []Col) error {
	// TODO(3.2): Reject an empty name, an empty column list, a duplicate table, or a duplicate column.
	// Store a copy of cols on a new Table.
	panic("TODO(3.2): Create")
}

// Insert appends one row. The width and the cell types must match the table.
func (db *DB) Insert(name string, row []Value) error {
	// TODO(3.3): Lookup the table. Reject a width mismatch or a cell whose T is not the column's Type.
	// Append a copy of the row.
	panic("TODO(3.3): Insert")
}
