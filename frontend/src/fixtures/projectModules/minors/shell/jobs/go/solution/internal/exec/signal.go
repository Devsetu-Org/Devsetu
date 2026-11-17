package exec

import (
	"os"
	"os/signal"
	"syscall"
)

// withForegroundInterrupt delivers SIGINT to the shell process only as a hook
// point for students: while a foreground pipeline runs, Ctrl-C is observed and
// forwarded to the child process group when possible. Without a controlling
// TTY job-control story, we interrupt each child process directly.
func (s *Shell) withForegroundInterrupt(procs []proc, run func() int) int {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT)
	defer signal.Stop(ch)

	done := make(chan int, 1)
	go func() { done <- run() }()

	for {
		select {
		case st := <-done:
			return st
		case <-ch:
			for _, p := range procs {
				if p.cmd != nil && p.cmd.Process != nil {
					_ = p.cmd.Process.Signal(syscall.SIGINT)
				}
			}
		}
	}
}
