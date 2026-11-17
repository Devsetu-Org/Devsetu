package parse

import (
	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// splitPipeline accepts a single command; pipes come in a later chapter.
func (p *parser) splitPipeline() ([]ast.Cmd, error) {
	if p.kind() == lex.Pipe {
		return nil, p.errf("pipelines not supported yet")
	}
	cmd, err := p.cmd()
	if err != nil {
		return nil, err
	}
	if p.kind() == lex.Pipe {
		return nil, p.errf("pipelines not supported yet")
	}
	return []ast.Cmd{cmd}, nil
}
