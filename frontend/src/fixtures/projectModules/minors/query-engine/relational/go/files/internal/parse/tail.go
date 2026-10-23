package parse

import "github.com/devlabs/sqlq/internal/lex"

// parseTail parses the optional GROUP BY, ORDER BY, and LIMIT clauses.
func (p *Parser) parseTail(s *Select) error {
	if p.at(lex.KwGroup) || p.at(lex.KwOrder) || p.at(lex.KwLimit) {
		// TODO(5.1): GROUP BY expr {, expr}. ORDER BY expr [ASC|DESC] {, expr}. LIMIT int.
		// Store expressions on s.Group, OrderKey values on s.Order, and the limit on s.Limit.
		panic("TODO(5.1): parseTail")
	}
	return nil
}

// parseJoin parses [INNER] JOIN table [alias] ON a = b.
func (p *Parser) parseJoin() (*Join, error) {
	// TODO(5.1): Optional INNER, then JOIN, a table, parseAlias, ON, a primary, '=', a primary.
	panic("TODO(5.1): parseJoin")
}
