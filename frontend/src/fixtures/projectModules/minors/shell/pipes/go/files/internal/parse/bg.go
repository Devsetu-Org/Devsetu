package parse

import "github.com/devlabs/tinysh/internal/lex"

// takeBackground rejects background jobs until the jobs chapter.
func (p *parser) takeBackground() (bool, error) {
	if p.kind() == lex.Amp {
		return false, p.errf("background jobs not supported yet")
	}
	return false, nil
}
