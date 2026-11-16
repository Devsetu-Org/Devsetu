package exec

import (
	"os"

	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// applyRedirsIO overlays opened redirect files onto the base stdio.
func applyRedirsIO(base stdio, redirs []ast.Redir, files []*os.File) stdio {
	// TODO(3.3)
	panic("TODO(3.3)")
}

var _ = lex.RedirIn
var _ = ast.Redir{}
