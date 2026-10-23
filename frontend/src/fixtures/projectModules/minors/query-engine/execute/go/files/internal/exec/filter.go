package exec

// Next returns the next child row that satisfies Pred.
func (f *Filter) Next() (Row, bool, error) {
	// TODO(4.3): Pull from Child until Pred returns true. Pass through a false ok or an error.
	panic("TODO(4.3): Filter.Next")
}
