package exec

import (
	"sync"
)

// addJob records a background pipeline. Processes are waited on by builtinWait.
func (s *Shell) addJob(procs []proc) {
	// TODO(5.1)
	panic("TODO(5.1)")
}

func (s *Shell) builtinWait(args []string) int {
	// TODO(5.2)
	panic("TODO(5.2)")
}

var _ = sync.Mutex{}
