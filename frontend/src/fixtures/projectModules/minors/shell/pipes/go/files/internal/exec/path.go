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
	if name == "" {
		return "", ErrNotFound
	}
	if strings.Contains(name, string(os.PathSeparator)) {
		path := name
		if !filepath.IsAbs(path) {
			path = filepath.Join(dir, path)
		}
		return checkExec(path)
	}
	pathEnv := envGet(env, "PATH")
	for _, dir := range filepath.SplitList(pathEnv) {
		if dir == "" {
			dir = "."
		}
		cand := filepath.Join(dir, name)
		if p, err := checkExec(cand); err == nil {
			return p, nil
		}
	}
	return "", ErrNotFound
}

func checkExec(path string) (string, error) {
	st, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if st.IsDir() {
		return "", ErrNotFound
	}
	// Unix: any regular file we can "stat" may be exec'd; the kernel decides.
	// Require the execute bit for a clearer student model.
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
