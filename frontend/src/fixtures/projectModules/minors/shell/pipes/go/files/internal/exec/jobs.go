package exec

func (s *Shell) addJob(procs []proc) {
	s.printfErr("background jobs not supported yet\n")
	for _, p := range procs {
		_ = p.cmd.Process.Kill()
		_ = waitCmd(p.cmd, p.files)
	}
}

func (s *Shell) builtinWait(args []string) int {
	s.printfErr("wait: not supported yet\n")
	return 1
}
