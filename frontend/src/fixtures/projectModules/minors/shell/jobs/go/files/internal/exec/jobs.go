package exec

import (
	"sync"
)

// addJob records a background pipeline. Processes are waited on by builtinWait.
func (s *Shell) addJob(procs []proc) {
	// TODO(5.1): Create a job with a done channel, append under s.mu, wait in a goroutine.
	panic("TODO(5.1): addJob")
}

func (s *Shell) builtinWait(args []string) int {
	// TODO(5.2): Reject args. Drain s.jobs, wait for each done channel, return last status.
	panic("TODO(5.2): builtinWait")
}

var _ = sync.Mutex{}
