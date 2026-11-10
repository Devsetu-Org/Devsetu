import unittest
from sqlq import Open


def setup_db():
    db = Open()
    for s in [
        "CREATE TABLE users (id INT, name TEXT)",
        "INSERT INTO users VALUES (1, 'ada'), (2, 'bea'), (3, 'cy')",
        "CREATE TABLE orders (id INT, user_id INT, total INT)",
        "INSERT INTO orders VALUES (1, 1, 5), (2, 1, 20), (3, 2, 15)",
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

    def test_join_group_order_limit(self):
        db = setup_db()
        res = db.Query(
            """SELECT u.name, COUNT(*) AS n
            FROM users u JOIN orders o ON u.id = o.user_id
            WHERE o.total > 10
            GROUP BY u.name
            ORDER BY n DESC
            LIMIT 1"""
        )
        self.assertEqual(len(res.rows), 1)
        self.assertEqual(str(res.rows[0][0]), "ada")
        self.assertEqual(str(res.rows[0][1]), "1")

    def test_sum(self):
        db = setup_db()
        res = db.Query("SELECT SUM(total) FROM orders")
        self.assertEqual(len(res.rows), 1)
        self.assertEqual(str(res.rows[0][0]), "40")

    def test_bad_insert(self):
        db = setup_db()
        with self.assertRaises(Exception):
            db.Exec("INSERT INTO users VALUES ('nope', 'x')")


if __name__ == "__main__":
    unittest.main()
