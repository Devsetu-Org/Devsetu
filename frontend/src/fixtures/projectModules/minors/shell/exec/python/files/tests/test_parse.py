import unittest

from tinysh.lex import Scan, RedirOut
from tinysh.parse import Parse


class TestParse(unittest.TestCase):
    def test_parse_simple(self):
        pl = Parse(Scan("echo hello"))
        self.assertEqual(len(pl.cmds), 1)
        self.assertFalse(pl.background)
        self.assertEqual(pl.cmds[0].argv, ["echo", "hello"])

if __name__ == "__main__":
    unittest.main()
