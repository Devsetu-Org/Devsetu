package exec

// Next projects the next child row.
func (p *Project) Next() (Row, bool, error) {
	row, ok, err := p.Child.Next()
	if err != nil || !ok {
		return Row{}, ok, err
	}
	out, err := p.Pick(row)
	if err != nil {
		return Row{}, false, err
	}
	return out, true, nil
}
