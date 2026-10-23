package parse

// parseCreate parses CREATE TABLE name (col type, ...).
func (p *Parser) parseCreate() (*CreateTable, error) {
	// TODO(3.1): CREATE TABLE ident '(' col type {',' col type} ')'.
	// Type is INT or TEXT via parseType. Column names stay as written.
	panic("TODO(3.1): parseCreate")
}

func (p *Parser) parseType() (TypeName, error) {
	// TODO(3.1): KwInt -> TypeInt, KwText -> TypeText, else an error.
	panic("TODO(3.1): parseType")
}

// parseInsert parses INSERT INTO name VALUES (...), (...).
func (p *Parser) parseInsert() (*Insert, error) {
	// TODO(3.1): INSERT INTO ident VALUES, then one or more parenthesized lists of primaries.
	panic("TODO(3.1): parseInsert")
}
