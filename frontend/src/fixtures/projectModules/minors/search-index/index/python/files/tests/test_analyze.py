"""Chapter 1 analyzer tests."""

from __future__ import annotations

import unittest

from findx.analyze import analyze, filter_stop, lower, tokenize


class TestAnalyze(unittest.TestCase):
    def test_tokenize(self) -> None:
        self.assertEqual(
            tokenize("Hello, world! Don't 123 go."),
            ["Hello", "world", "Don", "t", "go"],
        )
        self.assertEqual(tokenize(""), [])

    def test_lower(self) -> None:
        self.assertEqual(lower(["Hello", "WORLD"]), ["hello", "world"])

    def test_filter_stop(self) -> None:
        self.assertEqual(filter_stop(["the", "cat", "and", "dog", "a"]), ["cat", "dog"])

    def test_analyze(self) -> None:
        self.assertEqual(
            analyze("The Cat in the Hat sat on a mat."),
            ["cat", "hat", "sat", "mat"],
        )


if __name__ == "__main__":
    unittest.main()
