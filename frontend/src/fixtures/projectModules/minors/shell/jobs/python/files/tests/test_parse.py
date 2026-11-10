import unittest

from tinysh.lex import Scan, RedirOut
from tinysh.parse import Parse


class TestParse(unittest.TestCase):
    def test_parse_simple(self):
        pl = Parse(Scan("echo hello"))
        self.assertEqual(len(pl.cmds), 1)
        self.assertFalse(pl.background)
        self.assertEqual(pl.cmds[0].argv, ["echo", "hello"])

    def test_parse_redirects(self):
        pl = Parse(Scan("echo hi > out 2> err < in"))
        c = pl.cmds[0]
        self.assertEqual(c.argv[:2], ["echo", "hi"])
        self.assertEqual(len(c.redirs), 3)
        self.assertEqual(c.redirs[0].kind, RedirOut)
        self.assertEqual(c.redirs[0].file, "out")

    def test_parse_pipeline(self):
        pl = Parse(Scan("echo a | tr a-z A-Z | cat"))
        self.assertEqual(len(pl.cmds), 3)

    def test_parse_background(self):
        pl = Parse(Scan("sleep 1 &"))
        self.assertTrue(pl.background)
        self.assertEqual(len(pl.cmds), 1)


if __name__ == "__main__":
    unittest.main()
