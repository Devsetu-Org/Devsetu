package catalog

import "testing"

func TestCreateInsert(t *testing.T) {
	db := New()
	if err := db.Create("users", []Col{{"id", TypeInt}, {"name", TypeText}}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create("users", []Col{{"id", TypeInt}}); err == nil {
		t.Fatal("duplicate")
	}
	if err := db.Insert("users", []Value{Int(1), Text("ada")}); err != nil {
		t.Fatal(err)
	}
	if err := db.Insert("users", []Value{Text("x")}); err == nil {
		t.Fatal("width")
	}
	if err := db.Insert("users", []Value{Text("x"), Text("y")}); err == nil {
		t.Fatal("type")
	}
	tbl, err := db.Lookup("users")
	if err != nil || len(tbl.Rows) != 1 {
		t.Fatal(tbl, err)
	}
}
