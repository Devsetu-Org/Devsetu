package parse

// parseSelect parses SELECT items FROM table [alias] [WHERE expr], then the trailing clauses.
func (p *Parser) parseSelect() (*Select, error) {
	// TODO(2.3) — parseSelect
	panic("TODO(2.3)")
}

func (p *Parser) parseSelectItem() (SelectItem, error) {
	// TODO(2.3) — parseSelectItem
	panic("TODO(2.3)")
}

// parseAlias reads [AS] name, or "" when the next token is not a name.
func (p *Parser) parseAlias() string {
	// TODO(2.3) — parseAlias
	panic("TODO(2.3)")
}
