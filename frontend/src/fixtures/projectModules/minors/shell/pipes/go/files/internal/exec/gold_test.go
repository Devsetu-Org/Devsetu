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

func TestRedirectOut(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "out.txt")
	_, _, st := run(t, dir, `echo hello > out.txt`)
	if st != 0 {
		t.Fatalf("status %d", st)
	}
	b, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "hello\n" {
		t.Fatalf("%q", b)
	}
}

func TestRedirectAppend(t *testing.T) {
	dir := t.TempDir()
	_, _, st := run(t, dir, `echo a > out.txt`, `echo b >> out.txt`)
	if st != 0 {
		t.Fatalf("status %d", st)
	}
	b, err := os.ReadFile(filepath.Join(dir, "out.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "a\nb\n" {
		t.Fatalf("%q", b)
	}
}

func TestRedirectIn(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "in.txt"), []byte("xyz\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	stdout, _, st := run(t, dir, `cat < in.txt`)
	if st != 0 || stdout != "xyz\n" {
		t.Fatalf("st=%d out=%q", st, stdout)
	}
}

func TestRedirectErr(t *testing.T) {
	dir := t.TempDir()
	// Use a tiny helper: write to stderr via shell printf in a subshell-less way.
	// sh -c is available on macOS/Linux.
	_, _, st := run(t, dir, `sh -c 'echo oops 1>&2' 2> err.txt`)
	if st != 0 {
		t.Fatalf("status %d", st)
	}
	b, err := os.ReadFile(filepath.Join(dir, "err.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "oops\n" {
		t.Fatalf("%q", b)
	}
}

func TestPipe(t *testing.T) {
	dir := t.TempDir()
	stdout, _, st := run(t, dir, `printf 'abc\n' | tr a-z A-Z`)
	if st != 0 || stdout != "ABC\n" {
		t.Fatalf("st=%d out=%q", st, stdout)
	}
}

func TestPipeStatus(t *testing.T) {
	dir := t.TempDir()
	_, _, st := run(t, dir, `true | false`)
	if st == 0 {
		t.Fatal("pipeline status should be last command")
	}
	_, _, st = run(t, dir, `false | true`)
	if st != 0 {
		t.Fatalf("want 0 got %d", st)
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
