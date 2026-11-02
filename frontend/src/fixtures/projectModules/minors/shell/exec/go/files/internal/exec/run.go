package exec

import (
	osexec "os/exec"
)

// startProcess looks up argv[0] and starts the process with the given stdio.
// It does not wait. The caller waits with waitProcess.
func (s *Shell) startProcess(argv []string, io stdio) (*osexec.Cmd, error) {
	// TODO(2.2): LookPath argv[0], build osexec.Command with Dir/Env/stdio, Start it.
	panic("TODO(2.2): startProcess")
}

// waitProcess waits for a process started by startProcess and returns its status.
func waitProcess(c *osexec.Cmd) int {
	// TODO(2.2): Wait and map the error to an exit status (nil -> 0, ExitError -> ExitCode, else 127).
	panic("TODO(2.2): waitProcess")
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
