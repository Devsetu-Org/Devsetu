package parse

// parseSelect parses SELECT items FROM table [alias] [WHERE expr], then the trailing clauses.
func (p *Parser) parseSelect() (*Select, error) {
	// TODO(2.3): SELECT, one or more items separated by commas, FROM, a table name,
	// parseAlias, parseFromTail, an optional WHERE expression, then finishSelect.
	panic("TODO(2.3): parseSelect")
}

func (p *Parser) parseSelectItem() (SelectItem, error) {
	// TODO(2.3): '*' is SelectItem{Star: true}. Otherwise an expression, then an optional AS name.
	panic("TODO(2.3): parseSelectItem")
}

// parseAlias reads [AS] name, or "" when the next token is not a name.
func (p *Parser) parseAlias() string {
	// TODO(2.3): AS ident, or a bare ident, or "".
	panic("TODO(2.3): parseAlias")
}
