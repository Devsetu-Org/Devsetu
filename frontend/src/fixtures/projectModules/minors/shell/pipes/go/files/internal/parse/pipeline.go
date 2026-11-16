package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// splitPipeline reads one or more commands separated by |.
func (p *parser) splitPipeline() ([]ast.Cmd, error) {
	cmd, err := p.cmd()
	if err != nil {
		return nil, err
	}
	cmds := []ast.Cmd{cmd}
	if p.kind() != lex.Pipe {
		return cmds, nil
	}
	// TODO(4.1)
	panic("TODO(4.1)")
}
