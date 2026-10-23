package exec

import (
	"testing"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

func TestScanFilter(t *testing.T) {
	db := catalog.New()
	if err := db.Create("t", []catalog.Col{{Name: "id", Type: catalog.TypeInt}}); err != nil {
		t.Fatal(err)
	}
	if err := db.Insert("t", []catalog.Value{catalog.Int(1)}); err != nil {
		t.Fatal(err)
	}
	if err := db.Insert("t", []catalog.Value{catalog.Int(2)}); err != nil {
		t.Fatal(err)
	}
	stmt, err := parse.Parse("SELECT id FROM t WHERE id > 1")
	if err != nil {
		t.Fatal(err)
	}
	rows, err := RunSelect(db, stmt.(*parse.Select))
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Vals[0].I != 2 {
		t.Fatalf("%v", rows)
	}
}
