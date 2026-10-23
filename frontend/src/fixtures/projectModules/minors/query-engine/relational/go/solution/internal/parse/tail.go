package parse

import "github.com/devlabs/sqlq/internal/lex"

// parseTail parses the optional GROUP BY, ORDER BY, and LIMIT clauses.
func (p *Parser) parseTail(s *Select) error {
	if p.eat(lex.KwGroup) {
		if _, err := p.expect(lex.KwBy); err != nil {
			return err
		}
		for {
			e, err := p.parseExpr()
			if err != nil {
				return err
			}
			s.Group = append(s.Group, e)
			if !p.eat(lex.Comma) {
				break
			}
		}
	}
	if p.eat(lex.KwOrder) {
		if _, err := p.expect(lex.KwBy); err != nil {
			return err
		}
		for {
			e, err := p.parseExpr()
			if err != nil {
				return err
			}
			key := OrderKey{Expr: e}
			switch {
			case p.eat(lex.KwDesc):
				key.Desc = true
			case p.eat(lex.KwAsc):
			}
			s.Order = append(s.Order, key)
			if !p.eat(lex.Comma) {
				break
			}
		}
	}
	if p.eat(lex.KwLimit) {
		t, err := p.expect(lex.Int)
		if err != nil {
			return err
		}
		n, err := parseInt(t.Lit)
		if err != nil {
			return p.errorf("bad limit")
		}
		s.Limit = &n
	}
	return nil
}

func (p *Parser) parseJoin() (*Join, error) {
	p.eat(lex.KwInner)
	if _, err := p.expect(lex.KwJoin); err != nil {
		return nil, err
	}
	name, err := p.expect(lex.Ident)
	if err != nil {
		return nil, err
	}
	j := &Join{Table: name.Lit, Alias: p.parseAlias()}
	if _, err := p.expect(lex.KwOn); err != nil {
		return nil, err
	}
	left, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(lex.Eq); err != nil {
		return nil, err
	}
	right, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	j.Left, j.Right = left, right
	return j, nil
}
