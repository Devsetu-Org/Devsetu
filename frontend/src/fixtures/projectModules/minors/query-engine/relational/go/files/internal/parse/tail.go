package parse

import "github.com/devlabs/sqlq/internal/lex"

// parseTail parses the optional GROUP BY, ORDER BY, and LIMIT clauses.
func (p *Parser) parseTail(s *Select) error {
	if p.at(lex.KwGroup) || p.at(lex.KwOrder) || p.at(lex.KwLimit) {
		// TODO(5.1) — parseTail
		panic("TODO(5.1)")
	}
	return nil
}

// parseJoin parses [INNER] JOIN table [alias] ON a = b.
func (p *Parser) parseJoin() (*Join, error) {
	// TODO(5.1) — parseJoin
	panic("TODO(5.1)")
}
