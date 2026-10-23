package lex

// scanIdent reads an identifier or keyword. The caller has already seen a letter or '_'.
func (s *Scanner) scanIdent() (Token, error) {
	// TODO(1.1): From s.i, read while isIdentPart(s.peek()) using bump.
	// Return Token{Kind: Keyword(lit), Lit: lit, Pos: start}. Lit keeps the original case.
	panic("TODO(1.1): scanIdent")
}

// scanNumber reads a run of digits. The caller has already seen a digit.
func (s *Scanner) scanNumber() (Token, error) {
	// TODO(1.2): Read while isDigit(s.peek()). Return Token{Kind: Int, Lit: lit, Pos: start}.
	panic("TODO(1.2): scanNumber")
}

// scanString reads a single-quoted string. The caller has already seen the opening quote.
// Two quotes in a row are one quote character. A newline or EOF inside the string is an error.
func (s *Scanner) scanString() (Token, error) {
	// TODO(1.2): Skip the opening quote. Append bytes until the closing quote.
	// A doubled quote ('') is one quote in the literal. Newline or EOF returns
	// &Error{Pos: start, Msg: "unterminated string"}. Kind is String, Lit is the decoded text.
	panic("TODO(1.2): scanString")
}

// scanSymbol reads one punctuation character.
func (s *Scanner) scanSymbol() (Token, error) {
	// TODO(1.3): Map * , ( ) = < > ; . to Star, Comma, LParen, RParen, Eq, Lt, Gt, Semicolon, Dot.
	// Anything else is &Error{Pos: pos, Msg: "unexpected character"}.
	panic("TODO(1.3): scanSymbol")
}
