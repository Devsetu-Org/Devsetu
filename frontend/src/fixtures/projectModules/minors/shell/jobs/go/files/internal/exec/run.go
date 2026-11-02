package exec

import (
	osexec "os/exec"
)

// startProcess looks up argv[0] and starts the process with the given stdio.
// It does not wait. The caller waits with waitProcess.
func (s *Shell) startProcess(argv []string, io stdio) (*osexec.Cmd, error) {
	path, err := LookPath(argv[0], s.Dir, s.Env)
	if err != nil {
		return nil, err
	}
	c := osexec.Command(path, argv[1:]...)
	c.Dir = s.Dir
	c.Env = s.Env
	c.Stdin = io.in
	c.Stdout = io.out
	c.Stderr = io.err
	if err := c.Start(); err != nil {
		return nil, err
	}
	return c, nil
}

// waitProcess waits for a process started by startProcess and returns its status.
func waitProcess(c *osexec.Cmd) int {
	return exitStatus(c.Wait())
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
