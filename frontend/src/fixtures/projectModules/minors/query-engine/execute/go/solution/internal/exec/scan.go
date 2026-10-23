package exec

import "github.com/devlabs/sqlq/internal/catalog"

// Next returns the next row of the scan.
func (s *Scan) Next() (Row, bool, error) {
	if s.i >= len(s.Rows) {
		return Row{}, false, nil
	}
	vals := append([]catalog.Value(nil), s.Rows[s.i]...)
	s.i++
	return Row{Cols: append([]string(nil), s.Cols...), Vals: vals}, true, nil
}
