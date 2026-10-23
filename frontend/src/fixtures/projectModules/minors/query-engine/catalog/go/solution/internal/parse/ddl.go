package parse

import "github.com/devlabs/sqlq/internal/lex"

// parseCreate parses CREATE TABLE name (col type, ...).
func (p *Parser) parseCreate() (*CreateTable, error) {
	if _, err := p.expect(lex.KwCreate); err != nil {
		return nil, err
	}
	if _, err := p.expect(lex.KwTable); err != nil {
		return nil, err
	}
	name, err := p.expect(lex.Ident)
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(lex.LParen); err != nil {
		return nil, err
	}
	ct := &CreateTable{Name: name.Lit}
	for {
		col, err := p.expect(lex.Ident)
		if err != nil {
			return nil, err
		}
		typ, err := p.parseType()
		if err != nil {
			return nil, err
		}
		ct.Cols = append(ct.Cols, Column{Name: col.Lit, Type: typ})
		if p.eat(lex.Comma) {
			continue
		}
		break
	}
	if _, err := p.expect(lex.RParen); err != nil {
		return nil, err
	}
	return ct, nil
}

func (p *Parser) parseType() (TypeName, error) {
	switch {
	case p.eat(lex.KwInt):
		return TypeInt, nil
	case p.eat(lex.KwText):
		return TypeText, nil
	default:
		return 0, p.errorf("expected INT or TEXT")
	}
}

// parseInsert parses INSERT INTO name VALUES (...), (...).
func (p *Parser) parseInsert() (*Insert, error) {
	if _, err := p.expect(lex.KwInsert); err != nil {
		return nil, err
	}
	if _, err := p.expect(lex.KwInto); err != nil {
		return nil, err
	}
	name, err := p.expect(lex.Ident)
	if err != nil {
		return nil, err
	}
	if _, err := p.expect(lex.KwValues); err != nil {
		return nil, err
	}
	ins := &Insert{Table: name.Lit}
	for {
		if _, err := p.expect(lex.LParen); err != nil {
			return nil, err
		}
		var row []Expr
		for {
			e, err := p.parsePrimary()
			if err != nil {
				return nil, err
			}
			row = append(row, e)
			if p.eat(lex.Comma) {
				continue
			}
			break
		}
		if _, err := p.expect(lex.RParen); err != nil {
			return nil, err
		}
		ins.Rows = append(ins.Rows, row)
		if p.eat(lex.Comma) {
			continue
		}
		break
	}
	return ins, nil
}
