package exec

import (
	"io"
	"os"
	osexec "os/exec"
	"sync"

	"github.com/devlabs/tinysh/internal/ast"
)

type stdio struct {
	in  io.Reader
	out io.Writer
	err io.Writer
}

// lockedWriter serializes Write for shared shell stdout/stderr across a pipeline.
type lockedWriter struct {
	mu sync.Mutex
	w  io.Writer
}

func (l *lockedWriter) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.w.Write(p)
}

func shareWriter(w io.Writer) io.Writer {
	if w == nil {
		return nil
	}
	if _, ok := w.(*os.File); ok {
		return w
	}
	if _, ok := w.(*lockedWriter); ok {
		return w
	}
	return &lockedWriter{w: w}
}

// startCmd opens redirects, applies them over base stdio, and starts the process.
func (s *Shell) startCmd(cmd ast.Cmd, base stdio) (*osexec.Cmd, []*os.File, error) {
	files, err := openRedirs(s.Dir, cmd.Redirs)
	if err != nil {
		return nil, nil, err
	}
	io := applyRedirsIO(base, cmd.Redirs, files)
	c, err := s.startProcess(cmd.Argv, io)
	if err != nil {
		closeAll(files)
		return nil, nil, err
	}
	return c, files, nil
}

func closeAll(files []*os.File) {
	for _, f := range files {
		_ = f.Close()
	}
}

func waitCmd(c *osexec.Cmd, files []*os.File) int {
	st := waitProcess(c)
	closeAll(files)
	return st
}
