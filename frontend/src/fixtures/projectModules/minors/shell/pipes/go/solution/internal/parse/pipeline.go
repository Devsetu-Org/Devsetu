package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// splitPipeline reads one or more commands separated by |.
func (p *parser) splitPipeline() ([]ast.Cmd, error) {
	var cmds []ast.Cmd
	for {
		cmd, err := p.cmd()
		if err != nil {
			return nil, err
		}
		cmds = append(cmds, cmd)
		if p.kind() != lex.Pipe {
			break
		}
		p.bump()
		if p.kind() == lex.EOF || p.kind() == lex.Amp || p.kind() == lex.Pipe {
			return nil, p.errf("missing command after |")
		}
	}
	return cmds, nil
}
