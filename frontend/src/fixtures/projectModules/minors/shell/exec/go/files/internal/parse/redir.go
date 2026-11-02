package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// parseRedir rejects redirects until the redirects chapter.
func (p *parser) parseRedir() (ast.Redir, error) {
	_ = lex.RedirOut
	return ast.Redir{}, p.errf("redirects not supported yet")
}
