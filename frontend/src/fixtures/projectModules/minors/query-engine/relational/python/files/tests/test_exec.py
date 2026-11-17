import unittest
from sqlq.catalog import Col, Int, New, TypeInt
from sqlq.execute import RunSelect
from sqlq.parse import Parse, Select


class TestExec(unittest.TestCase):
    def test_scan_filter(self):
        db = New()
        db.Create("t", [Col(name="id", type=TypeInt)])
        db.Insert("t", [Int(1)])
        db.Insert("t", [Int(2)])
        stmt = Parse("SELECT id FROM t WHERE id > 1")
        self.assertIsInstance(stmt, Select)
        rows = RunSelect(db, stmt)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].vals[0].i, 2)


if __name__ == "__main__":
    unittest.main()
