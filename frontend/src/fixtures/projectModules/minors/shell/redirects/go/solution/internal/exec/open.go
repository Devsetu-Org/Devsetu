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
	path := r.File
	if !filepath.IsAbs(path) {
		path = filepath.Join(dir, path)
	}
	switch r.Kind {
	case lex.RedirOut:
		return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	case lex.RedirApp:
		return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	case lex.RedirIn:
		return os.OpenFile(path, os.O_RDONLY, 0)
	case lex.RedirErr:
		return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	default:
		return nil, fmt.Errorf("unknown redirect %s", r.Kind)
	}
}
