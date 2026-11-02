package exec

import "github.com/devlabs/tinysh/internal/ast"

// runPipeline runs a single foreground command (no pipes / jobs yet).
func (s *Shell) runPipeline(pl *ast.Pipeline) int {
	if len(pl.Cmds) == 0 {
		return 0
	}
	if pl.Background {
		s.printfErr("background jobs not supported yet\n")
		return 1
	}
	if len(pl.Cmds) != 1 {
		s.printfErr("pipelines not supported yet\n")
		return 1
	}
	cmd := pl.Cmds[0]
	if len(cmd.Argv) == 0 {
		s.printfErr("missing command\n")
		return 1
	}
	if isBuiltin(cmd.Argv[0]) {
		return s.runBuiltinWithRedirs(cmd)
	}
	c, files, err := s.startCmd(cmd, stdio{in: s.Stdin, out: s.Stdout, err: s.Stderr})
	if err != nil {
		s.printfErr("%s: %v\n", cmd.Argv[0], err)
		return 127
	}
	return waitCmd(c, files)
}
