import unittest
from sqlq.catalog import Col, Int, New, Text, TypeInt, TypeText


class TestCatalog(unittest.TestCase):
    def test_create_insert(self):
        db = New()
        db.Create("users", [Col("id", TypeInt), Col("name", TypeText)])
        with self.assertRaises(Exception):
            db.Create("users", [Col("id", TypeInt)])
        db.Insert("users", [Int(1), Text("ada")])
        with self.assertRaises(Exception):
            db.Insert("users", [Text("x")])
        with self.assertRaises(Exception):
            db.Insert("users", [Text("x"), Text("y")])
        tbl = db.Lookup("users")
        self.assertEqual(len(tbl.rows), 1)


if __name__ == "__main__":
    unittest.main()
