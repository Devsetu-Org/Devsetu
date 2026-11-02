package exec

import (
	"os"

	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// applyRedirsIO overlays opened redirect files onto the base stdio.
func applyRedirsIO(base stdio, redirs []ast.Redir, files []*os.File) stdio {
	out := base
	for i, r := range redirs {
		switch r.Kind {
		case lex.RedirIn:
			out.in = files[i]
		case lex.RedirOut, lex.RedirApp:
			out.out = files[i]
		case lex.RedirErr:
			out.err = files[i]
		}
	}
	return out
}
