package lex

// Scanner walks one shell line.
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
	if s.atOp() {
		return s.scanOp()
	}
	return s.scanWord()
}

func (s *Scanner) eof() bool { return s.i >= len(s.src) }

func (s *Scanner) peek() byte {
	if s.eof() {
		return 0
	}
	return s.src[s.i]
}

func (s *Scanner) peekAt(off int) byte {
	j := s.i + off
	if j >= len(s.src) {
		return 0
	}
	return s.src[j]
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

// atOp reports whether the next token is an operator.
func (s *Scanner) atOp() bool {
	switch s.peek() {
	case '|', '>', '<', '&':
		return true
	case '2':
		return s.peekAt(1) == '>'
	default:
		return false
	}
}

// opStart reports whether c begins an operator (used to end an unquoted word).
func opStart(c byte, next byte) bool {
	switch c {
	case '|', '>', '<', '&':
		return true
	case '2':
		return next == '>'
	default:
		return false
	}
}
