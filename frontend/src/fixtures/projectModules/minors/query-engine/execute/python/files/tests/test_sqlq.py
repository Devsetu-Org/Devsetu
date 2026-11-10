import unittest
from sqlq import Open


def setup_db():
    db = Open()
    for s in [
        "CREATE TABLE users (id INT, name TEXT)",
        "INSERT INTO users VALUES (1, 'ada'), (2, 'bea'), (3, 'cy')",
    ]:
        db.Exec(s)
    return db


class TestSqlq(unittest.TestCase):
    def test_filter_project(self):
        db = setup_db()
        res = db.Query("SELECT name FROM users WHERE id = 1")
        self.assertEqual(len(res.rows), 1)
        self.assertEqual(str(res.rows[0][0]), "ada")

    def test_and(self):
        db = setup_db()
        res = db.Query("SELECT id FROM users WHERE id > 1 AND name < 'cy'")
        self.assertEqual(len(res.rows), 1)
        self.assertEqual(str(res.rows[0][0]), "2")

    def test_bad_insert(self):
        db = setup_db()
        with self.assertRaises(Exception):
            db.Exec("INSERT INTO users VALUES ('nope', 'x')")


if __name__ == "__main__":
    unittest.main()
