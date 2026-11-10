import unittest
from sqlq import Open


class TestSqlq(unittest.TestCase):
    def test_create_insert(self):
        db = Open()
        db.Exec("CREATE TABLE users (id INT, name TEXT)")
        db.Exec("INSERT INTO users VALUES (1, 'ada')")
        with self.assertRaises(Exception):
            db.Query("SELECT name FROM users")

    def test_bad_insert(self):
        db = Open()
        db.Exec("CREATE TABLE users (id INT, name TEXT)")
        with self.assertRaises(Exception):
            db.Exec("INSERT INTO users VALUES ('nope', 'x')")


if __name__ == "__main__":
    unittest.main()
