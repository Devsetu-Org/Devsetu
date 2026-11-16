package exec

import (
	"os"
	"os/signal"
	"syscall"
)

// withForegroundInterrupt runs fn while forwarding SIGINT to child processes.
func (s *Shell) withForegroundInterrupt(procs []proc, fn func() int) int {
	_ = procs
	_ = os.Interrupt
	_ = signal.Notify
	_ = syscall.SIGINT
	// TODO(5.3)
	return fn()
}
