package lex

// scanIdent reads an identifier or keyword. The caller has already seen a letter or '_'.
func (s *Scanner) scanIdent() (Token, error) {
	start := s.i
	for !s.eof() && isIdentPart(s.peek()) {
		s.bump()
	}
	lit := s.src[start:s.i]
	return Token{Kind: Keyword(lit), Lit: lit, Pos: start}, nil
}

// scanNumber reads a run of digits. The caller has already seen a digit.
func (s *Scanner) scanNumber() (Token, error) {
	start := s.i
	for !s.eof() && isDigit(s.peek()) {
		s.bump()
	}
	return Token{Kind: Int, Lit: s.src[start:s.i], Pos: start}, nil
}

// scanString reads a single-quoted string. The caller has already seen the opening quote.
// Two quotes in a row are one quote character. A newline or EOF inside the string is an error.
func (s *Scanner) scanString() (Token, error) {
	start := s.i
	s.bump()
	var b []byte
	for !s.eof() {
		c := s.bump()
		if c == '\n' {
			return Token{}, &Error{Pos: start, Msg: "unterminated string"}
		}
		if c == '\'' {
			if !s.eof() && s.peek() == '\'' {
				s.bump()
				b = append(b, '\'')
				continue
			}
			return Token{Kind: String, Lit: string(b), Pos: start}, nil
		}
		b = append(b, c)
	}
	return Token{}, &Error{Pos: start, Msg: "unterminated string"}
}

// scanSymbol reads one punctuation character.
func (s *Scanner) scanSymbol() (Token, error) {
	pos := s.i
	c := s.bump()
	var k Kind
	switch c {
	case '*':
		k = Star
	case ',':
		k = Comma
	case '(':
		k = LParen
	case ')':
		k = RParen
	case '=':
		k = Eq
	case '<':
		k = Lt
	case '>':
		k = Gt
	case ';':
		k = Semicolon
	case '.':
		k = Dot
	default:
		return Token{}, &Error{Pos: pos, Msg: "unexpected character"}
	}
	return Token{Kind: k, Lit: string(c), Pos: pos}, nil
}
