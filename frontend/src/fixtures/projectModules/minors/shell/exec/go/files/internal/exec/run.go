package exec

import (
	osexec "os/exec"
)

// startProcess looks up argv[0] and starts the process with the given stdio.
// It does not wait. The caller waits with waitProcess.
func (s *Shell) startProcess(argv []string, io stdio) (*osexec.Cmd, error) {
	// TODO(2.2)
	panic("TODO(2.2)")
}

// waitProcess waits for a process started by startProcess and returns its status.
func waitProcess(c *osexec.Cmd) int {
	// TODO(2.2)
	panic("TODO(2.2)")
}

func exitStatus(err error) int {
	if err == nil {
		return 0
	}
	if ee, ok := err.(*osexec.ExitError); ok {
		return ee.ExitCode()
	}
	return 127
}
