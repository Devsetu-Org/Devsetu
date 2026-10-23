package lex

import "testing"

func kinds(toks []Token) []Kind {
	out := make([]Kind, len(toks))
	for i, t := range toks {
		out[i] = t.Kind
	}
	return out
}

func TestScanSelect(t *testing.T) {
	toks, err := Scan("SELECT name FROM users WHERE id = 1;")
	if err != nil {
		t.Fatal(err)
	}
	want := []Kind{KwSelect, Ident, KwFrom, Ident, KwWhere, Ident, Eq, Int, Semicolon, EOF}
	got := kinds(toks)
	if len(got) != len(want) {
		t.Fatalf("kinds %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("tok %d: got %s want %s (%v)", i, got[i], want[i], got)
		}
	}
	if toks[1].Lit != "name" || toks[7].Lit != "1" {
		t.Fatalf("lits %#v", toks)
	}
}

func TestKeywordCase(t *testing.T) {
	toks, err := Scan("SeLeCt")
	if err != nil {
		t.Fatal(err)
	}
	if toks[0].Kind != KwSelect || toks[0].Lit != "SeLeCt" {
		t.Fatalf("%#v", toks[0])
	}
}

func TestString(t *testing.T) {
	toks, err := Scan("'a''b'")
	if err != nil {
		t.Fatal(err)
	}
	if toks[0].Kind != String || toks[0].Lit != "a'b" {
		t.Fatalf("%#v", toks[0])
	}
}

func TestUnterminated(t *testing.T) {
	if _, err := Scan("'abc"); err == nil {
		t.Fatal("expected error")
	}
}

func TestBadChar(t *testing.T) {
	if _, err := Scan("SELECT @"); err == nil {
		t.Fatal("expected error")
	}
}
