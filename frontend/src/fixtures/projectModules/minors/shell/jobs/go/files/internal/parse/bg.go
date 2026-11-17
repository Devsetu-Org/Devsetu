package parse

import "github.com/devlabs/tinysh/internal/lex"

// takeBackground consumes a trailing & when present.
func (p *parser) takeBackground() (bool, error) {
	if p.kind() != lex.Amp {
		return false, nil
	}
	p.bump()
	return true, nil
}
