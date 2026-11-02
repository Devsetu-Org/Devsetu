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
			s.bump()
			if s.eof() {
				return Token{}, &Error{Pos: start, Msg: "trailing backslash"}
			}
			b = append(b, s.bump())
		case '\'':
			s.bump()
			for {
				if s.eof() {
					return Token{}, &Error{Pos: start, Msg: "unterminated single quote"}
				}
				q := s.bump()
				if q == '\'' {
					break
				}
				b = append(b, q)
			}
		case '"':
			s.bump()
			for {
				if s.eof() {
					return Token{}, &Error{Pos: start, Msg: "unterminated double quote"}
				}
				q := s.bump()
				if q == '"' {
					break
				}
				if q == '\\' {
					if s.eof() {
						return Token{}, &Error{Pos: start, Msg: "trailing backslash"}
					}
					b = append(b, s.bump())
					continue
				}
				b = append(b, q)
			}
		default:
			b = append(b, s.bump())
		}
	}
	if len(b) == 0 && s.i == start {
		return Token{}, &Error{Pos: start, Msg: "empty word"}
	}
	return Token{Kind: Word, Lit: string(b), Pos: start}, nil
}

// scanOp reads one operator token. The caller has already checked atOp().
func (s *Scanner) scanOp() (Token, error) {
	pos := s.i
	c := s.bump()
	switch c {
	case '|':
		return Token{Kind: Pipe, Lit: "|", Pos: pos}, nil
	case '<':
		return Token{Kind: RedirIn, Lit: "<", Pos: pos}, nil
	case '&':
		return Token{Kind: Amp, Lit: "&", Pos: pos}, nil
	case '>':
		if !s.eof() && s.peek() == '>' {
			s.bump()
			return Token{Kind: RedirApp, Lit: ">>", Pos: pos}, nil
		}
		return Token{Kind: RedirOut, Lit: ">", Pos: pos}, nil
	case '2':
		if s.eof() || s.peek() != '>' {
			return Token{}, &Error{Pos: pos, Msg: "expected 2>"}
		}
		s.bump()
		return Token{Kind: RedirErr, Lit: "2>", Pos: pos}, nil
	default:
		return Token{}, &Error{Pos: pos, Msg: "unexpected operator"}
	}
}
