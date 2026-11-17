import os
import tempfile
import unittest

from tinygit.index.add import add
from tinygit.index.codec import decode, encode, load
from tinygit.index.status import status
from tinygit.repo import init


class TestIndex(unittest.TestCase):
    def test_codec_and_add_status(self):
        with tempfile.TemporaryDirectory() as root:
            r = init(root)
            with open(os.path.join(root, "a.txt"), "wb") as f:
                f.write(b"one\n")
            add(r, "a.txt")
            idx = load(r.index_path())
            self.assertEqual(len(idx.entries), 1)
            self.assertEqual(idx.entries[0].path, "a.txt")
            data = encode(idx)
            idx2 = decode(data)
            self.assertEqual(len(idx2.entries), 1)

            st = status(r)
            self.assertEqual(st.staged, ["a.txt"])
            with open(os.path.join(root, "a.txt"), "wb") as f:
                f.write(b"two\n")
            st = status(r)
            self.assertEqual(len(st.modified), 1)
            with open(os.path.join(root, "b.txt"), "wb") as f:
                f.write(b"u\n")
            st = status(r)
            self.assertEqual(st.untracked, ["b.txt"])


if __name__ == "__main__":
    unittest.main()
