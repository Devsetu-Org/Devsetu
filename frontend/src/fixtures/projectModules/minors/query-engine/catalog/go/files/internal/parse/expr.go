package parse

import "github.com/devlabs/sqlq/internal/lex"

// parseExpr parses an expression. AND binds looser than a comparison.
func (p *Parser) parseExpr() (Expr, error) {
	return p.parseAnd()
}

func (p *Parser) parseAnd() (Expr, error) {
	left, err := p.parseCmp()
	if err != nil {
		return nil, err
	}
	for p.eat(lex.KwAnd) {
		right, err := p.parseCmp()
		if err != nil {
			return nil, err
		}
		left = &Binary{Op: "AND", L: left, R: right}
	}
	return left, nil
}

func (p *Parser) parseCmp() (Expr, error) {
	left, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	op := ""
	switch {
	case p.eat(lex.Eq):
		op = "="
	case p.eat(lex.Lt):
		op = "<"
	case p.eat(lex.Gt):
		op = ">"
	default:
		return left, nil
	}
	right, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	return &Binary{Op: op, L: left, R: right}, nil
}

func (p *Parser) parsePrimary() (Expr, error) {
	switch {
	case p.at(lex.Int):
		t, _ := p.expect(lex.Int)
		n, err := parseInt(t.Lit)
		if err != nil {
			return nil, p.errorf("bad integer")
		}
		return &IntLit{V: n}, nil
	case p.at(lex.String):
		t, _ := p.expect(lex.String)
		return &StrLit{V: t.Lit}, nil
	case p.at(lex.KwCount):
		return p.parseCall("count", true)
	case p.at(lex.KwSum):
		return p.parseCall("sum", false)
	case p.at(lex.Ident):
		t, _ := p.expect(lex.Ident)
		if p.eat(lex.Dot) {
			col, err := p.expect(lex.Ident)
			if err != nil {
				return nil, err
			}
			return &Qual{Table: t.Lit, Name: col.Lit}, nil
		}
		return &Ident{Name: t.Lit}, nil
	case p.eat(lex.LParen):
		e, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(lex.RParen); err != nil {
			return nil, err
		}
		return e, nil
	default:
		return nil, p.errorf("expected an expression")
	}
}

func (p *Parser) parseCall(name string, allowStar bool) (Expr, error) {
	if name == "count" {
		p.eat(lex.KwCount)
	} else {
		p.eat(lex.KwSum)
	}
	if _, err := p.expect(lex.LParen); err != nil {
		return nil, err
	}
	if allowStar && p.eat(lex.Star) {
		if _, err := p.expect(lex.RParen); err != nil {
			return nil, err
		}
		return &Call{Name: name, Star: true}, nil
	}
	arg, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(lex.RParen); err != nil {
		return nil, err
	}
	return &Call{Name: name, Arg: arg}, nil
}
