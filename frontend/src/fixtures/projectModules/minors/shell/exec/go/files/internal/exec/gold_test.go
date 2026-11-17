package exec_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/devlabs/tinysh/internal/exec"
)

func run(t *testing.T, dir string, lines ...string) (stdout, stderr string, status int) {
	t.Helper()
	var out, errBuf bytes.Buffer
	sh := &exec.Shell{
		Stdin:  strings.NewReader(""),
		Stdout: &out,
		Stderr: &errBuf,
		Dir:    dir,
		Env:    os.Environ(),
	}
	status = 0
	for _, line := range lines {
		status = sh.RunLine(line)
		if sh.Exited() {
			status = sh.LastStatus()
			break
		}
	}
	return out.String(), errBuf.String(), status
}

func TestEcho(t *testing.T) {
	dir := t.TempDir()
	stdout, stderr, st := run(t, dir, `echo hello`)
	if st != 0 || stderr != "" || stdout != "hello\n" {
		t.Fatalf("st=%d out=%q err=%q", st, stdout, stderr)
	}
}

func TestExitStatus(t *testing.T) {
	dir := t.TempDir()
	_, _, st := run(t, dir, `false`)
	if st == 0 {
		t.Fatal("expected non-zero")
	}
	_, _, st = run(t, dir, `true`)
	if st != 0 {
		t.Fatalf("true -> %d", st)
	}
}

func TestCd(t *testing.T) {
	dir := t.TempDir()
	sub := filepath.Join(dir, "sub")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	stdout, _, st := run(t, dir, `cd sub`, `pwd`)
	if st != 0 {
		t.Fatalf("status %d", st)
	}
	got, err := filepath.EvalSymlinks(strings.TrimSpace(stdout))
	if err != nil {
		t.Fatal(err)
	}
	want, err := filepath.EvalSymlinks(sub)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("pwd %q want %q", got, want)
	}
}

func TestExitBuiltin(t *testing.T) {
	dir := t.TempDir()
	_, _, st := run(t, dir, `exit 7`)
	if st != 7 {
		t.Fatalf("got %d", st)
	}
}

func TestQuotesInArgv(t *testing.T) {
	dir := t.TempDir()
	stdout, _, st := run(t, dir, `echo 'a b'`)
	if st != 0 || stdout != "a b\n" {
		t.Fatalf("st=%d out=%q", st, stdout)
	}
}

func TestCommandNotFound(t *testing.T) {
	dir := t.TempDir()
	_, stderr, st := run(t, dir, `definitely-not-a-real-command-xyz`)
	if st == 0 {
		t.Fatal("expected failure")
	}
	if !strings.Contains(stderr, "not found") && !strings.Contains(stderr, "definitely-not") {
		t.Fatalf("stderr %q", stderr)
	}
}
