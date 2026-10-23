package parse

import (
	"fmt"
	"strconv"

	"github.com/devlabs/sqlq/internal/lex"
)

// Parser is a recursive-descent cursor over tokens.
type Parser struct {
	toks []lex.Token
	i    int
}

// Parse scans and parses one statement. A trailing semicolon is optional.
func Parse(src string) (Stmt, error) {
	toks, err := lex.Scan(src)
	if err != nil {
		return nil, err
	}
	p := &Parser{toks: toks}
	stmt, err := p.parseStmt()
	if err != nil {
		return nil, err
	}
	p.eat(lex.Semicolon)
	if !p.at(lex.EOF) {
		return nil, p.errorf("unexpected token %s", p.peek().Kind)
	}
	return stmt, nil
}

func (p *Parser) parseStmt() (Stmt, error) {
	switch {
	case p.at(lex.KwCreate):
		return p.parseCreate()
	case p.at(lex.KwInsert):
		return p.parseInsert()
	case p.at(lex.KwSelect):
		return p.parseSelect()
	default:
		return nil, p.errorf("expected a statement")
	}
}

// parseFromTail parses a JOIN that sits between FROM and WHERE.
func (p *Parser) parseFromTail(s *Select) error {
	if p.at(lex.KwInner) || p.at(lex.KwJoin) {
		j, err := p.parseJoin()
		if err != nil {
			return err
		}
		s.Join = j
	}
	return nil
}

// finishSelect parses GROUP BY, ORDER BY, and LIMIT.
func (p *Parser) finishSelect(s *Select) error {
	return p.parseTail(s)
}

func (p *Parser) peek() lex.Token { return p.toks[p.i] }

func (p *Parser) at(k lex.Kind) bool { return p.peek().Kind == k }

func (p *Parser) eat(k lex.Kind) bool {
	if !p.at(k) {
		return false
	}
	p.i++
	return true
}

func (p *Parser) expect(k lex.Kind) (lex.Token, error) {
	t := p.peek()
	if t.Kind != k {
		return lex.Token{}, p.errorf("expected %s", k)
	}
	p.i++
	return t, nil
}

func (p *Parser) errorf(format string, args ...any) error {
	return fmt.Errorf("at %d: "+format, append([]any{p.peek().Pos}, args...)...)
}

func parseInt(lit string) (int64, error) {
	return strconv.ParseInt(lit, 10, 64)
}
