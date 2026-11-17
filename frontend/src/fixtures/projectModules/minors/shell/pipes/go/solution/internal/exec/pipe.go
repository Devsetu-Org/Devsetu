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
	procs = make([]proc, n)
	var pipes [][2]*os.File

	for i, cmd := range pl.Cmds {
		if len(cmd.Argv) == 0 {
			s.printfErr("missing command\n")
			cleanupPipes(pipes)
			return nil, 1
		}
		if isBuiltin(cmd.Argv[0]) && (n > 1 || pl.Background) {
			s.printfErr("%s: builtin not allowed in pipeline or background\n", cmd.Argv[0])
			cleanupPipes(pipes)
			return nil, 1
		}

		base := stdio{in: s.Stdin, out: shareWriter(s.Stdout), err: shareWriter(s.Stderr)}
		if i > 0 {
			base.in = pipes[i-1][0]
		}
		if i < n-1 {
			r, w, err := os.Pipe()
			if err != nil {
				s.printfErr("pipe: %v\n", err)
				cleanupPipes(pipes)
				return nil, 1
			}
			pipes = append(pipes, [2]*os.File{r, w})
			base.out = w
		}

		c, files, err := s.startCmd(cmd, base)
		if err != nil {
			s.printfErr("%s: %v\n", cmd.Argv[0], err)
			cleanupPipes(pipes)
			for j := 0; j < i; j++ {
				_ = procs[j].cmd.Process.Kill()
				_, _ = procs[j].cmd.Process.Wait()
				closeAll(procs[j].files)
			}
			return nil, 127
		}
		procs[i] = proc{cmd: c, files: files}

		if i < n-1 {
			_ = pipes[i][1].Close()
			pipes[i][1] = nil
		}
		if i > 0 {
			_ = pipes[i-1][0].Close()
			pipes[i-1][0] = nil
		}
	}
	return procs, -1
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
