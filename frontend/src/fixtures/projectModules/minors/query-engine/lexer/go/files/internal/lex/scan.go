package lex

// scanIdent reads an identifier or keyword. The caller has already seen a letter or '_'.
func (s *Scanner) scanIdent() (Token, error) {
	// TODO(1.1) — scanIdent
	panic("TODO(1.1)")
}

// scanNumber reads a run of digits. The caller has already seen a digit.
func (s *Scanner) scanNumber() (Token, error) {
	// TODO(1.2) — scanNumber
	panic("TODO(1.2)")
}

// scanString reads a single-quoted string. The caller has already seen the opening quote.
// Two quotes in a row are one quote character. A newline or EOF inside the string is an error.
func (s *Scanner) scanString() (Token, error) {
	// TODO(1.2) — scanString
	panic("TODO(1.2)")
}

// scanSymbol reads one punctuation character.
func (s *Scanner) scanSymbol() (Token, error) {
	// TODO(1.3) — scanSymbol
	panic("TODO(1.3)")
}
