package exec

// Next returns the next child row that satisfies Pred.
func (f *Filter) Next() (Row, bool, error) {
	for {
		row, ok, err := f.Child.Next()
		if err != nil || !ok {
			return Row{}, ok, err
		}
		keep, err := f.Pred(row)
		if err != nil {
			return Row{}, false, err
		}
		if keep {
			return row, true, nil
		}
	}
}
