package parse

// parseExpr parses an expression. AND binds looser than a comparison.
func (p *Parser) parseExpr() (Expr, error) {
	return p.parseAnd()
}

// parseAnd parses comparisons joined by AND.
func (p *Parser) parseAnd() (Expr, error) {
	// TODO(2.1): parseCmp, then while the next token is AND, parse another comparison
	// and wrap the two in &Binary{Op: "AND", L: left, R: right}.
	panic("TODO(2.1): parseAnd")
}

// parseCmp parses a comparison, or a bare primary when there is no operator.
func (p *Parser) parseCmp() (Expr, error) {
	// TODO(2.1): parsePrimary. If the next token is =, <, or >, consume it, parse another
	// primary, and return &Binary{Op: "=", "<", or ">", L: left, R: right}. Otherwise return the primary.
	panic("TODO(2.1): parseCmp")
}

// parsePrimary parses a literal, a name, a qualified name, a call, or a parenthesized expression.
func (p *Parser) parsePrimary() (Expr, error) {
	// TODO(2.2): Int -> &IntLit (parseInt). String -> &StrLit. COUNT/SUM -> parseCall.
	// Ident, then an optional . Ident, -> &Qual or &Ident. '(' expr ')' returns the inner expr.
	// Anything else is p.errorf("expected an expression").
	panic("TODO(2.2): parsePrimary")
}

// parseCall parses COUNT(*) or SUM(expr). name is "count" or "sum".
func (p *Parser) parseCall(name string, allowStar bool) (Expr, error) {
	// TODO(2.2): Consume the keyword, '(', then either '*' (only when allowStar) or an expression, then ')'.
	// Return &Call{Name: name, Star: true} or &Call{Name: name, Arg: arg}.
	panic("TODO(2.2): parseCall")
}
