package lex

// Scanner walks one SQL string. The four scan methods are the chapter's work.
type Scanner struct {
	src string
	i   int
}

// Scan returns every token, including a final EOF.
func Scan(src string) ([]Token, error) {
	s := &Scanner{src: src}
	var out []Token
	for {
		s.skipSpace()
		if s.eof() {
			out = append(out, Token{Kind: EOF, Pos: s.i})
			return out, nil
		}
		tok, err := s.next()
		if err != nil {
			return nil, err
		}
		out = append(out, tok)
	}
}

func (s *Scanner) next() (Token, error) {
	switch c := s.peek(); {
	case isIdentStart(c):
		return s.scanIdent()
	case isDigit(c):
		return s.scanNumber()
	case c == '\'':
		return s.scanString()
	default:
		return s.scanSymbol()
	}
}

func (s *Scanner) eof() bool { return s.i >= len(s.src) }

func (s *Scanner) peek() byte {
	if s.eof() {
		return 0
	}
	return s.src[s.i]
}

func (s *Scanner) bump() byte {
	c := s.src[s.i]
	s.i++
	return c
}

func (s *Scanner) skipSpace() {
	for !s.eof() {
		switch s.peek() {
		case ' ', '\t', '\n', '\r':
			s.i++
		default:
			return
		}
	}
}

func isIdentStart(c byte) bool {
	return c == '_' || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
}

func isIdentPart(c byte) bool {
	return isIdentStart(c) || isDigit(c)
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }
