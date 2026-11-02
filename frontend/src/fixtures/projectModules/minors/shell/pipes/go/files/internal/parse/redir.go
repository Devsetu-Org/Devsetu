package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// parseRedir reads a redirect operator and the filename word that follows.
func (p *parser) parseRedir() (ast.Redir, error) {
	k := p.kind()
	p.bump()
	if p.kind() != lex.Word {
		return ast.Redir{}, p.errf("expected filename after redirect")
	}
	return ast.Redir{Kind: k, File: p.bump().Lit}, nil
}
