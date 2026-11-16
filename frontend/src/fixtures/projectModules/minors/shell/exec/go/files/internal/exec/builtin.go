package exec

import (
	"os"
	"path/filepath"
	"strconv"
)

// isBuiltin reports whether argv0 is handled inside the shell.
func isBuiltin(name string) bool {
	switch name {
	case "cd", "exit", "wait":
		return true
	default:
		return false
	}
}

// runBuiltin runs a builtin. ok is false when name is not a builtin.
func (s *Shell) runBuiltin(argv []string) (status int, ok bool) {
	if len(argv) == 0 {
		return 0, false
	}
	switch argv[0] {
	case "cd":
		return s.builtinCd(argv[1:]), true
	case "exit":
		return s.builtinExit(argv[1:]), true
	case "wait":
		return s.builtinWait(argv[1:]), true
	default:
		return 0, false
	}
}

func (s *Shell) builtinCd(args []string) int {
	// TODO(2.3)
	panic("TODO(2.3)")
}

func (s *Shell) builtinExit(args []string) int {
	// TODO(2.3)
	panic("TODO(2.3)")
}

var _ = os.ErrNotExist
var _ = filepath.Separator
var _ = strconv.Itoa
