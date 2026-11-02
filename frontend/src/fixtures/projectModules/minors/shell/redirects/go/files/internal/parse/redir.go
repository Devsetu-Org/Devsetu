package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// parseRedir reads a redirect operator and the filename word that follows.
func (p *parser) parseRedir() (ast.Redir, error) {
	// TODO(3.1): Record Kind from the current token, bump, require a Word, return Redir.
	panic("TODO(3.1): parseRedir")
}

var _ = lex.Word
