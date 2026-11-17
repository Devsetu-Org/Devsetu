import unittest
from sqlq.lex import Scan, LexError
from sqlq.lex.token import (
    EOF, Eq, Ident, Int, KwFrom, KwSelect, KwWhere, Semicolon, String,
)


class TestLex(unittest.TestCase):
    def test_scan_select(self):
        toks = Scan("SELECT name FROM users WHERE id = 1;")
        want = [KwSelect, Ident, KwFrom, Ident, KwWhere, Ident, Eq, Int, Semicolon, EOF]
        got = [t.kind for t in toks]
        self.assertEqual(got, want)
        self.assertEqual(toks[1].lit, "name")
        self.assertEqual(toks[7].lit, "1")

    def test_keyword_case(self):
        toks = Scan("SeLeCt")
        self.assertEqual(toks[0].kind, KwSelect)
        self.assertEqual(toks[0].lit, "SeLeCt")

    def test_string(self):
        toks = Scan("'a''b'")
        self.assertEqual(toks[0].kind, String)
        self.assertEqual(toks[0].lit, "a'b")

    def test_unterminated(self):
        with self.assertRaises(LexError):
            Scan("'abc")

    def test_bad_char(self):
        with self.assertRaises(LexError):
            Scan("SELECT @")


if __name__ == "__main__":
    unittest.main()
