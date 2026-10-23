package parse

import "github.com/devlabs/sqlq/internal/lex"

// parseSelect parses SELECT items FROM table [alias] [WHERE expr], then the trailing clauses.
func (p *Parser) parseSelect() (*Select, error) {
	if _, err := p.expect(lex.KwSelect); err != nil {
		return nil, err
	}
	sel := &Select{}
	for {
		item, err := p.parseSelectItem()
		if err != nil {
			return nil, err
		}
		sel.Items = append(sel.Items, item)
		if !p.eat(lex.Comma) {
			break
		}
	}
	if _, err := p.expect(lex.KwFrom); err != nil {
		return nil, err
	}
	name, err := p.expect(lex.Ident)
	if err != nil {
		return nil, err
	}
	sel.From = name.Lit
	sel.Alias = p.parseAlias()
	if err := p.parseFromTail(sel); err != nil {
		return nil, err
	}
	if p.eat(lex.KwWhere) {
		e, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		sel.Where = e
	}
	if err := p.finishSelect(sel); err != nil {
		return nil, err
	}
	return sel, nil
}

func (p *Parser) parseSelectItem() (SelectItem, error) {
	if p.eat(lex.Star) {
		return SelectItem{Star: true}, nil
	}
	e, err := p.parseExpr()
	if err != nil {
		return SelectItem{}, err
	}
	item := SelectItem{Expr: e}
	if p.eat(lex.KwAs) {
		a, err := p.expect(lex.Ident)
		if err != nil {
			return SelectItem{}, err
		}
		item.Alias = a.Lit
	}
	return item, nil
}

// parseAlias reads [AS] name, or "" when the next token is not a name.
func (p *Parser) parseAlias() string {
	if p.eat(lex.KwAs) {
		a, err := p.expect(lex.Ident)
		if err != nil {
			return ""
		}
		return a.Lit
	}
	if p.at(lex.Ident) {
		a, _ := p.expect(lex.Ident)
		return a.Lit
	}
	return ""
}
