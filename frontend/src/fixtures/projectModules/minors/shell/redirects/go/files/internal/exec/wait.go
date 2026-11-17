package exec

func (s *Shell) waitForeground(procs []proc) int {
	status := 0
	for i, p := range procs {
		st := waitCmd(p.cmd, p.files)
		if i == len(procs)-1 {
			status = st
		}
	}
	return status
}
