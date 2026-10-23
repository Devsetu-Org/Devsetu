package parse

import "testing"

func TestParseSelect(t *testing.T) {
	stmt, err := Parse("SELECT name FROM users u WHERE id = 1 AND name > 'a'")
	if err != nil {
		t.Fatal(err)
	}
	sel, ok := stmt.(*Select)
	if !ok {
		t.Fatalf("%T", stmt)
	}
	if sel.From != "users" || sel.Alias != "u" || len(sel.Items) != 1 {
		t.Fatalf("%#v", sel)
	}
	bin, ok := sel.Where.(*Binary)
	if !ok || bin.Op != "AND" {
		t.Fatalf("where %#v", sel.Where)
	}
}

func TestParseBroken(t *testing.T) {
	if _, err := Parse("SELECT FROM t"); err == nil {
		t.Fatal("expected error")
	}
}
