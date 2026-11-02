package exec

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// ErrNotFound means no executable matched the name on PATH.
var ErrNotFound = errors.New("command not found")

// LookPath finds an executable for name. Absolute or relative names that
// already contain a slash are checked relative to dir. Otherwise PATH is searched.
func LookPath(name, dir string, env []string) (string, error) {
	// TODO(2.1): If name contains a path separator, resolve against dir when relative
	// and checkExec it. Otherwise split PATH from env and try each directory.
	panic("TODO(2.1): LookPath")
}

func checkExec(path string) (string, error) {
	st, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if st.IsDir() {
		return "", ErrNotFound
	}
	if st.Mode()&0o111 == 0 {
		return "", ErrNotFound
	}
	return path, nil
}

func envGet(env []string, key string) string {
	prefix := key + "="
	for i := len(env) - 1; i >= 0; i-- {
		if strings.HasPrefix(env[i], prefix) {
			return env[i][len(prefix):]
		}
	}
	return ""
}

// Keep filepath imported for the student solution.
var _ = filepath.Separator
