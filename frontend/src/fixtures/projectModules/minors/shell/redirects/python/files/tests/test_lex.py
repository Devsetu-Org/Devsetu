import unittest

from tinysh.lex import Scan, Amp, EOF, Pipe, RedirApp, RedirErr, RedirIn, RedirOut, Word
from tinysh.lex.token import Error


class TestLex(unittest.TestCase):
    def test_words_and_quotes(self):
        toks = Scan("echo 'hello world' \"hi there\"")
        kinds = [t.kind for t in toks]
        self.assertEqual(kinds, [Word, Word, Word, EOF])
        self.assertEqual(toks[0].lit, "echo")
        self.assertEqual(toks[1].lit, "hello world")
        self.assertEqual(toks[2].lit, "hi there")

    def test_escapes(self):
        toks = Scan(r'echo hello\ world "a\"b" \>')
        self.assertEqual(toks[1].lit, "hello world")
        self.assertEqual(toks[2].lit, 'a"b')
        self.assertEqual(toks[3].kind, Word)
        self.assertEqual(toks[3].lit, ">")

    def test_operators(self):
        toks = Scan("a | b > out >> log < in 2> err &")
        want = [Word, Pipe, Word, RedirOut, Word, RedirApp, Word, RedirIn, Word, RedirErr, Word, Amp, EOF]
        self.assertEqual([t.kind for t in toks], want)

    def test_unterminated(self):
        with self.assertRaises(Error):
            Scan("echo 'abc")
        with self.assertRaises(Error):
            Scan('echo "abc')


if __name__ == "__main__":
    unittest.main()
