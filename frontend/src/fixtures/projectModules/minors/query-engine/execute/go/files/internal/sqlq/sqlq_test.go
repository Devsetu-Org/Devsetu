package sqlq

import "testing"

func setup(t *testing.T) *DB {
	t.Helper()
	db := Open()
	for _, s := range []string{
		"CREATE TABLE users (id INT, name TEXT)",
		"INSERT INTO users VALUES (1, 'ada'), (2, 'bea'), (3, 'cy')",
		"CREATE TABLE orders (id INT, user_id INT, total INT)",
		"INSERT INTO orders VALUES (1, 1, 5), (2, 1, 20), (3, 2, 15)",
	} {
		if err := db.Exec(s); err != nil {
			t.Fatal(s, err)
		}
	}
	return db
}

func TestFilterProject(t *testing.T) {
	db := setup(t)
	res, err := db.Query("SELECT name FROM users WHERE id = 1")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Rows) != 1 || res.Rows[0][0].String() != "ada" {
		t.Fatalf("%v", res.Rows)
	}
}

func TestAnd(t *testing.T) {
	db := setup(t)
	res, err := db.Query("SELECT id FROM users WHERE id > 1 AND name < 'cy'")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Rows) != 1 || res.Rows[0][0].String() != "2" {
		t.Fatalf("%v", res.Rows)
	}
}

func TestBadInsert(t *testing.T) {
	db := setup(t)
	if err := db.Exec("INSERT INTO users VALUES ('nope', 'x')"); err == nil {
		t.Fatal("expected type error")
	}
}
