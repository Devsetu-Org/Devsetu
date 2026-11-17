package exec

import (
	"os"

	"github.com/devlabs/tinysh/internal/ast"
)

func applyRedirsIO(base stdio, redirs []ast.Redir, files []*os.File) stdio {
	return base
}
