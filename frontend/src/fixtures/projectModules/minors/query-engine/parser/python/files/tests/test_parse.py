import unittest
from sqlq.parse import Binary, Parse, Select


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


if __name__ == "__main__":
    unittest.main()
