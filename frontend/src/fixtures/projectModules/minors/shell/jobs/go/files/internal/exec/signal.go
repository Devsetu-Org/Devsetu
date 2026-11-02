package exec

import (
	"os"
	"os/signal"
	"syscall"
)

// withForegroundInterrupt runs fn while forwarding SIGINT to child processes.
func (s *Shell) withForegroundInterrupt(procs []proc, fn func() int) int {
	// The pass-through keeps ordinary tests green. Replace the body for TODO(5.3).
	_ = procs
	_ = os.Interrupt
	_ = signal.Notify
	_ = syscall.SIGINT
	// TODO(5.3): Notify on SIGINT, run fn in a goroutine, forward SIGINT to children.
	return fn()
}
