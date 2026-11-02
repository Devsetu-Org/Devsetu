// Package parse turns tokens into a pipeline.
package parse

import (
	"fmt"

	"github.com/devlabs/tinysh/internal/ast"
	"github.com/devlabs/tinysh/internal/lex"
)

// Parse builds a pipeline from a full token list (including trailing EOF).
func Parse(toks []lex.Token) (*ast.Pipeline, error) {
	p := &parser{toks: toks}
	pl, err := p.pipeline()
	if err != nil {
		return nil, err
	}
	if p.kind() != lex.EOF {
		return nil, p.errf("unexpected token %s", p.kind())
	}
	return pl, nil
}

type parser struct {
	toks []lex.Token
	i    int
}

func (p *parser) kind() lex.Kind {
	if p.i >= len(p.toks) {
		return lex.EOF
	}
	return p.toks[p.i].Kind
}

func (p *parser) bump() lex.Token {
	t := p.toks[p.i]
	p.i++
	return t
}

func (p *parser) errf(format string, args ...any) error {
	pos := 0
	if p.i < len(p.toks) {
		pos = p.toks[p.i].Pos
	}
	return &Error{Pos: pos, Msg: fmt.Sprintf(format, args...)}
}

// Error is a parse failure.
type Error struct {
	Pos int
	Msg string
}

func (e *Error) Error() string { return e.Msg }

func (p *parser) pipeline() (*ast.Pipeline, error) {
	cmds, err := p.splitPipeline()
	if err != nil {
		return nil, err
	}
	bg, err := p.takeBackground()
	if err != nil {
		return nil, err
	}
	return &ast.Pipeline{Cmds: cmds, Background: bg}, nil
}

func (p *parser) cmd() (ast.Cmd, error) {
	var c ast.Cmd
	for {
		switch p.kind() {
		case lex.Word:
			c.Argv = append(c.Argv, p.bump().Lit)
		case lex.RedirOut, lex.RedirApp, lex.RedirIn, lex.RedirErr:
			r, err := p.parseRedir()
			if err != nil {
				return c, err
			}
			c.Redirs = append(c.Redirs, r)
		default:
			if len(c.Argv) == 0 && len(c.Redirs) == 0 {
				return c, p.errf("expected command")
			}
			return c, nil
		}
	}
}
