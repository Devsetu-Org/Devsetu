package exec

import (
	"os"

	"github.com/devlabs/tinysh/internal/ast"
)

// runPipeline runs a foreground or background pipeline and returns the status
// of the last command. For background pipelines the status is 0 and the job
// is recorded for wait.
func (s *Shell) runPipeline(pl *ast.Pipeline) int {
	if len(pl.Cmds) == 0 {
		return 0
	}

	if len(pl.Cmds) == 1 && !pl.Background && len(pl.Cmds[0].Argv) > 0 && isBuiltin(pl.Cmds[0].Argv[0]) {
		return s.runBuiltinWithRedirs(pl.Cmds[0])
	}

	procs, errStatus := s.wirePipes(pl)
	if procs == nil {
		return errStatus
	}
	if pl.Background {
		s.addJob(procs)
		return 0
	}
	return s.withForegroundInterrupt(procs, func() int {
		return s.waitForeground(procs)
	})
}

// wirePipes starts every command in the pipeline with os.Pipe between neighbours.
// On failure it returns nil procs and a status. On success errStatus is unused.
func (s *Shell) wirePipes(pl *ast.Pipeline) (procs []proc, errStatus int) {
	n := len(pl.Cmds)
	if n == 1 {
		cmd := pl.Cmds[0]
		if len(cmd.Argv) == 0 {
			s.printfErr("missing command\n")
			return nil, 1
		}
		c, files, err := s.startCmd(cmd, stdio{in: s.Stdin, out: shareWriter(s.Stdout), err: shareWriter(s.Stderr)})
		if err != nil {
			s.printfErr("%s: %v\n", cmd.Argv[0], err)
			return nil, 127
		}
		return []proc{{cmd: c, files: files}}, -1
	}
	// TODO(4.2): For n > 1, create os.Pipe between neighbours, startCmd each stage,
	// close unused pipe ends in the parent, and return the procs.
	_ = os.Pipe
	panic("TODO(4.2): wirePipes")
}

func cleanupPipes(pipes [][2]*os.File) {
	for _, p := range pipes {
		if p[0] != nil {
			_ = p[0].Close()
		}
		if p[1] != nil {
			_ = p[1].Close()
		}
	}
}
