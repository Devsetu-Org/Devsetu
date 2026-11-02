package exec

import (
	"os"

	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// applyRedirsIO overlays opened redirect files onto the base stdio.
func applyRedirsIO(base stdio, redirs []ast.Redir, files []*os.File) stdio {
	// TODO(3.3): For each redir, assign files[i] onto in, out, or err by Kind.
	panic("TODO(3.3): applyRedirsIO")
}

var _ = lex.RedirIn
var _ = ast.Redir{}
