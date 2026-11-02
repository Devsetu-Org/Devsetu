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
			// TODO(1.2): bump past the backslash; on EOF return trailing-backslash error;
			// otherwise append the next bumped byte to b and continue.
			panic("TODO(1.2): backslash escape")
		case '\'':
			// TODO(1.1): bump past opening quote; append bytes until closing quote;
			// EOF returns unterminated single quote.
			panic("TODO(1.1): single-quoted word")
		case '"':
			// TODO(1.1): bump past opening quote; append bytes until closing quote.
			// Inside, a backslash escapes the next byte (TODO 1.2 shares this path).
			// EOF returns unterminated double quote.
			panic("TODO(1.1): double-quoted word")
		default:
			// TODO(1.1): append bump() to b.
			panic("TODO(1.1): unquoted character")
		}
	}
	_ = start
	_ = b
	panic("TODO(1.1): return Word token")
}

// scanOp reads one operator token. The caller has already checked atOp().
func (s *Scanner) scanOp() (Token, error) {
	// TODO(1.3): Map | < & > >> and 2> to Pipe, RedirIn, Amp, RedirOut, RedirApp, RedirErr.
	panic("TODO(1.3): scanOp")
}
