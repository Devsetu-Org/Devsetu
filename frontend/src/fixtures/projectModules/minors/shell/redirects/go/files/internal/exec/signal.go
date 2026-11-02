package exec

func (s *Shell) withForegroundInterrupt(procs []proc, fn func() int) int {
	_ = procs
	return fn()
}
