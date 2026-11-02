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
