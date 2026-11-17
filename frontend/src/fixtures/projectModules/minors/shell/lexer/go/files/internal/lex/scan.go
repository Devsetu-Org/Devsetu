package lex

// scanWord reads one word. The caller has already skipped space and checked !atOp.
// Unquoted text ends at whitespace or an operator. Single quotes keep every
// byte until the closing quote. Double quotes allow backslash escapes.
// Outside quotes, a backslash escapes the next byte.
func (s *Scanner) scanWord() (Token, error) {
	start := s.i
	var b []byte
	for !s.eof() {
		c := s.peek()
		if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
			break
		}
		if opStart(c, s.peekAt(1)) {
			break
		}
		switch c {
		case '\\':
			// TODO(1.2)
			panic("TODO(1.2)")
		case '\'':
			// TODO(1.1)
			panic("TODO(1.1)")
		case '"':
			// TODO(1.1)
			panic("TODO(1.1)")
		default:
			// TODO(1.1)
			panic("TODO(1.1)")
		}
	}
	_ = start
	_ = b
	// TODO(1.1)
	panic("TODO(1.1)")
}

// scanOp reads one operator token. The caller has already checked atOp().
func (s *Scanner) scanOp() (Token, error) {
	// TODO(1.3)
	panic("TODO(1.3)")
}
