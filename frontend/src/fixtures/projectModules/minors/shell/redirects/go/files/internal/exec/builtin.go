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
	var dir string
	switch len(args) {
	case 0:
		dir = envGet(s.Env, "HOME")
		if dir == "" {
			s.printfErr("cd: HOME not set\n")
			return 1
		}
	case 1:
		dir = args[0]
	default:
		s.printfErr("cd: too many arguments\n")
		return 1
	}
	if !filepath.IsAbs(dir) {
		dir = filepath.Join(s.Dir, dir)
	}
	st, err := os.Stat(dir)
	if err != nil || !st.IsDir() {
		name := dir
		if len(args) == 1 {
			name = args[0]
		}
		s.printfErr("cd: %s: no such directory\n", name)
		return 1
	}
	s.Dir = dir
	return 0
}

func (s *Shell) builtinExit(args []string) int {
	code := 0
	if len(args) > 0 {
		n, err := strconv.Atoi(args[0])
		if err != nil {
			s.printfErr("exit: numeric argument required\n")
			s.setExit(2)
			return 2
		}
		code = n
	}
	s.setExit(code)
	return code
}
