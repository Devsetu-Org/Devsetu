package parse

// parseExpr parses an expression. AND binds looser than a comparison.
func (p *Parser) parseExpr() (Expr, error) {
	return p.parseAnd()
}

// parseAnd parses comparisons joined by AND.
func (p *Parser) parseAnd() (Expr, error) {
	// TODO(2.1) — parseAnd
	panic("TODO(2.1)")
}

// parseCmp parses a comparison, or a bare primary when there is no operator.
func (p *Parser) parseCmp() (Expr, error) {
	// TODO(2.1) — parseCmp
	panic("TODO(2.1)")
}

// parsePrimary parses a literal, a name, a qualified name, a call, or a parenthesized expression.
func (p *Parser) parsePrimary() (Expr, error) {
	// TODO(2.2) — parsePrimary
	panic("TODO(2.2)")
}

// parseCall parses COUNT(*) or SUM(expr). name is "count" or "sum".
func (p *Parser) parseCall(name string, allowStar bool) (Expr, error) {
	// TODO(2.2) — parseCall
	panic("TODO(2.2)")
}
