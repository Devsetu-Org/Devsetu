package exec

import (
	"sync"
)

// addJob records a background pipeline. Processes are waited on by builtinWait.
func (s *Shell) addJob(procs []proc) {
	j := &job{
		done: make(chan int, 1),
	}
	s.mu.Lock()
	s.jobs = append(s.jobs, j)
	s.mu.Unlock()

	go func() {
		status := 0
		for i, p := range procs {
			st := waitCmd(p.cmd, p.files)
			if i == len(procs)-1 {
				status = st
			}
		}
		j.done <- status
		close(j.done)
	}()
}

func (s *Shell) builtinWait(args []string) int {
	if len(args) > 0 {
		s.printfErr("wait: arguments not supported\n")
		return 1
	}
	s.mu.Lock()
	jobs := append([]*job(nil), s.jobs...)
	s.jobs = nil
	s.mu.Unlock()

	status := 0
	var wg sync.WaitGroup
	var mu sync.Mutex
	for _, j := range jobs {
		wg.Add(1)
		go func(j *job) {
			defer wg.Done()
			st := <-j.done
			mu.Lock()
			status = st
			mu.Unlock()
		}(j)
	}
	wg.Wait()
	return status
}
