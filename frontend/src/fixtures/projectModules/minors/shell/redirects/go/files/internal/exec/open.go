package exec

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// openRedirs opens every redirection for a command, resolving paths against dir.
func openRedirs(dir string, redirs []ast.Redir) (files []*os.File, err error) {
	defer func() {
		if err != nil {
			closeAll(files)
			files = nil
		}
	}()
	for _, r := range redirs {
		f, e := openOne(dir, r)
		if e != nil {
			return nil, e
		}
		files = append(files, f)
	}
	return files, nil
}

// openOne opens one redirect target.
func openOne(dir string, r ast.Redir) (*os.File, error) {
	// TODO(3.2): Resolve r.File against dir. Open with trunc/append/read per Kind.
	panic("TODO(3.2): openOne")
}

var _ = fmt.Errorf
var _ = filepath.Separator
var _ = lex.RedirOut
