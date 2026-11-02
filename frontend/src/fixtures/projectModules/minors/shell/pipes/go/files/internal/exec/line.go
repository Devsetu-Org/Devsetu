package exec

import (
	"strings"

	"github.com/devlabs/tinysh/internal/lex"
	"github.com/devlabs/tinysh/internal/parse"
)

// RunLine lexes, parses, and runs one shell statement. Returns the exit status.
func (s *Shell) RunLine(line string) int {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return 0
	}
	toks, err := lex.Scan(line)
	if err != nil {
		s.printfErr("lex: %v\n", err)
		return 2
	}
	pl, err := parse.Parse(toks)
	if err != nil {
		s.printfErr("parse: %v\n", err)
		return 2
	}
	return s.runPipeline(pl)
}
