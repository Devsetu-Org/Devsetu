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

func TestParseCreateInsert(t *testing.T) {
	stmt, err := Parse("CREATE TABLE users (id INT, name TEXT)")
	if err != nil {
		t.Fatal(err)
	}
	ct := stmt.(*CreateTable)
	if ct.Name != "users" || len(ct.Cols) != 2 || ct.Cols[1].Type != TypeText {
		t.Fatalf("%#v", ct)
	}
	stmt, err = Parse("INSERT INTO users VALUES (1, 'ada'), (2, 'bea')")
	if err != nil {
		t.Fatal(err)
	}
	ins := stmt.(*Insert)
	if ins.Table != "users" || len(ins.Rows) != 2 {
		t.Fatalf("%#v", ins)
	}
}

func TestParseJoinAgg(t *testing.T) {
	stmt, err := Parse("SELECT u.name, COUNT(*) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name ORDER BY count(*) DESC LIMIT 5")
	if err != nil {
		t.Fatal(err)
	}
	sel := stmt.(*Select)
	if sel.Join == nil || sel.Join.Table != "orders" || len(sel.Group) != 1 || len(sel.Order) != 1 || !sel.Order[0].Desc || sel.Limit == nil || *sel.Limit != 5 {
		t.Fatalf("%#v", sel)
	}
}
