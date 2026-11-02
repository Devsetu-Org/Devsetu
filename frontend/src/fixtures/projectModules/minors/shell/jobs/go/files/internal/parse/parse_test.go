package parse

import (
	"testing"

	"github.com/devlabs/tinysh/internal/lex"
)

func mustScan(t *testing.T, s string) []lex.Token {
	t.Helper()
	toks, err := lex.Scan(s)
	if err != nil {
		t.Fatal(err)
	}
	return toks
}

func TestParseSimple(t *testing.T) {
	pl, err := Parse(mustScan(t, "echo hello"))
	if err != nil {
		t.Fatal(err)
	}
	if len(pl.Cmds) != 1 || pl.Background {
		t.Fatalf("%#v", pl)
	}
	if got := pl.Cmds[0].Argv; len(got) != 2 || got[0] != "echo" || got[1] != "hello" {
		t.Fatalf("%v", got)
	}
}

func TestParseRedirects(t *testing.T) {
	pl, err := Parse(mustScan(t, "echo hi > out 2> err < in"))
	if err != nil {
		t.Fatal(err)
	}
	c := pl.Cmds[0]
	if len(c.Argv) != 2 || c.Argv[0] != "echo" {
		t.Fatalf("argv %v", c.Argv)
	}
	if len(c.Redirs) != 3 {
		t.Fatalf("redirs %#v", c.Redirs)
	}
	if c.Redirs[0].Kind != lex.RedirOut || c.Redirs[0].File != "out" {
		t.Fatalf("%#v", c.Redirs[0])
	}
}

func TestParsePipeline(t *testing.T) {
	pl, err := Parse(mustScan(t, "echo a | tr a-z A-Z | cat"))
	if err != nil {
		t.Fatal(err)
	}
	if len(pl.Cmds) != 3 {
		t.Fatalf("%d cmds", len(pl.Cmds))
	}
}

func TestParseBackground(t *testing.T) {
	pl, err := Parse(mustScan(t, "sleep 1 &"))
	if err != nil {
		t.Fatal(err)
	}
	if !pl.Background || len(pl.Cmds) != 1 {
		t.Fatalf("%#v", pl)
	}
}
