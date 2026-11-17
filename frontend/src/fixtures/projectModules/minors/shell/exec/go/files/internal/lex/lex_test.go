package lex

import "testing"

func kinds(toks []Token) []Kind {
	out := make([]Kind, len(toks))
	for i, t := range toks {
		out[i] = t.Kind
	}
	return out
}

func TestWordsAndQuotes(t *testing.T) {
	toks, err := Scan(`echo 'hello world' "hi there"`)
	if err != nil {
		t.Fatal(err)
	}
	want := []Kind{Word, Word, Word, EOF}
	got := kinds(toks)
	if len(got) != len(want) {
		t.Fatalf("kinds %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("tok %d: got %s want %s", i, got[i], want[i])
		}
	}
	if toks[0].Lit != "echo" || toks[1].Lit != "hello world" || toks[2].Lit != "hi there" {
		t.Fatalf("lits %#v", toks)
	}
}

func TestEscapes(t *testing.T) {
	toks, err := Scan(`echo hello\ world "a\"b" \>`)
	if err != nil {
		t.Fatal(err)
	}
	if toks[1].Lit != "hello world" {
		t.Fatalf("escaped space: %q", toks[1].Lit)
	}
	if toks[2].Lit != `a"b` {
		t.Fatalf("double escape: %q", toks[2].Lit)
	}
	if toks[3].Kind != Word || toks[3].Lit != ">" {
		t.Fatalf("escaped op: %#v", toks[3])
	}
}

func TestOperators(t *testing.T) {
	toks, err := Scan(`a | b > out >> log < in 2> err &`)
	if err != nil {
		t.Fatal(err)
	}
	want := []Kind{Word, Pipe, Word, RedirOut, Word, RedirApp, Word, RedirIn, Word, RedirErr, Word, Amp, EOF}
	got := kinds(toks)
	if len(got) != len(want) {
		t.Fatalf("kinds %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("tok %d: got %s want %s (%v)", i, got[i], want[i], got)
		}
	}
}

func TestUnterminated(t *testing.T) {
	if _, err := Scan(`echo 'abc`); err == nil {
		t.Fatal("expected error")
	}
	if _, err := Scan(`echo "abc`); err == nil {
		t.Fatal("expected error")
	}
}
