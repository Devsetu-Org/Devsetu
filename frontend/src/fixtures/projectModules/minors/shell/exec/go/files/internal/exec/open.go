package exec

import (
	"os"

	"github.com/devlabs/tinysh/internal/ast"
)

func openRedirs(dir string, redirs []ast.Redir) ([]*os.File, error) {
	if len(redirs) == 0 {
		return nil, nil
	}
	return nil, os.ErrInvalid
}
