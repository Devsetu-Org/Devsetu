package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// parseRedir reads a redirect operator and the filename word that follows.
func (p *parser) parseRedir() (ast.Redir, error) {
	// TODO(3.1)
	panic("TODO(3.1)")
}

var _ = lex.Word
