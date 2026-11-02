// Package exec runs parsed pipelines: spawn, redirects, pipes, and jobs.
package exec

import (
	"fmt"
	"io"
	"os"
	"sync"
)

// Shell is one interactive (or scripted) shell session.
type Shell struct {
	Stdin  io.Reader
	Stdout io.Writer
	Stderr io.Writer
	Dir    string
	Env    []string

	mu     sync.Mutex
	jobs   []*job
	exited bool
	status int
}

type job struct {
	done chan int
}

// New returns a shell bound to the process stdio and environment.
func New() *Shell {
	return &Shell{
		Stdin:  os.Stdin,
		Stdout: os.Stdout,
		Stderr: os.Stderr,
		Dir:    mustGetwd(),
		Env:    os.Environ(),
	}
}

func mustGetwd() string {
	d, err := os.Getwd()
	if err != nil {
		return "."
	}
	return d
}

// Exited reports whether the exit builtin was called.
func (s *Shell) Exited() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.exited
}

// LastStatus is the status from the exit builtin when Exited is true.
func (s *Shell) LastStatus() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

func (s *Shell) setExit(code int) {
	s.mu.Lock()
	s.exited = true
	s.status = code
	s.mu.Unlock()
}

func (s *Shell) printfErr(format string, args ...any) {
	fmt.Fprintf(s.Stderr, format, args...)
}
