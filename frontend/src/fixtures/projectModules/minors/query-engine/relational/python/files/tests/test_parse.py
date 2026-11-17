import unittest
from sqlq.parse import Binary, CreateTable, Insert, Parse, Select, TypeText


class TestParse(unittest.TestCase):
    def test_parse_select(self):
        stmt = Parse("SELECT name FROM users u WHERE id = 1 AND name > 'a'")
        self.assertIsInstance(stmt, Select)
        self.assertEqual(stmt.from_table, "users")
        self.assertEqual(stmt.alias, "u")
        self.assertEqual(len(stmt.items), 1)
        self.assertIsInstance(stmt.where, Binary)
        self.assertEqual(stmt.where.op, "AND")

    def test_parse_broken(self):
        with self.assertRaises(Exception):
            Parse("SELECT FROM t")

    def test_parse_create_insert(self):
        stmt = Parse("CREATE TABLE users (id INT, name TEXT)")
        self.assertIsInstance(stmt, CreateTable)
        self.assertEqual(stmt.name, "users")
        self.assertEqual(len(stmt.cols), 2)
        self.assertEqual(stmt.cols[1].type, TypeText)
        stmt = Parse("INSERT INTO users VALUES (1, 'ada'), (2, 'bea')")
        self.assertIsInstance(stmt, Insert)
        self.assertEqual(stmt.table, "users")
        self.assertEqual(len(stmt.rows), 2)

    def test_parse_join_agg(self):
        stmt = Parse(
            "SELECT u.name, COUNT(*) FROM users u JOIN orders o ON u.id = o.user_id "
            "GROUP BY u.name ORDER BY count(*) DESC LIMIT 5"
        )
        self.assertIsInstance(stmt, Select)
        self.assertIsNotNone(stmt.join)
        self.assertEqual(stmt.join.table, "orders")
        self.assertEqual(len(stmt.group), 1)
        self.assertEqual(len(stmt.order), 1)
        self.assertTrue(stmt.order[0].desc)
        self.assertEqual(stmt.limit, 5)


if __name__ == "__main__":
    unittest.main()
