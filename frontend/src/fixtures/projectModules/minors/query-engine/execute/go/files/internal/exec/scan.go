package exec

// Next returns the next row of the scan.
func (s *Scan) Next() (Row, bool, error) {
	// TODO(4.1): When s.i is past s.Rows, return (Row{}, false, nil).
	// Otherwise return a copy of Cols and of the current row, then advance s.i.
	panic("TODO(4.1): Scan.Next")
}
