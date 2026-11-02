package exec

import (
	"github.com/devlabs/tinysh/internal/ast"
)

// runBuiltinWithRedirs runs a builtin, temporarily swapping shell stdio for redirects.
func (s *Shell) runBuiltinWithRedirs(cmd ast.Cmd) int {
	if len(cmd.Redirs) == 0 {
		st, _ := s.runBuiltin(cmd.Argv)
		return st
	}
	files, err := openRedirs(s.Dir, cmd.Redirs)
	if err != nil {
		s.printfErr("%v\n", err)
		return 1
	}
	defer closeAll(files)

	oldIn, oldOut, oldErr := s.Stdin, s.Stdout, s.Stderr
	io := applyRedirsIO(stdio{in: s.Stdin, out: s.Stdout, err: s.Stderr}, cmd.Redirs, files)
	s.Stdin, s.Stdout, s.Stderr = io.in, io.out, io.err
	st, _ := s.runBuiltin(cmd.Argv)
	s.Stdin, s.Stdout, s.Stderr = oldIn, oldOut, oldErr
	return st
}
