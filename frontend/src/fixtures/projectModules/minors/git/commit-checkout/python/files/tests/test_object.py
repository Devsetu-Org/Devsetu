import os
import tempfile
import unittest

from tinygit.object.blob import get_blob, put_blob
from tinygit.object.commit import Commit, get_commit, put_commit
from tinygit.object.hash import hash_of
from tinygit.object.store import Store
from tinygit.object.tree import MODE_FILE, TreeEntry, get_tree, put_tree


class TestObject(unittest.TestCase):
    def test_hash_of_known(self):
        h = hash_of(b"hello")
        self.assertEqual(h.hex(), "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")

    def test_store_blob_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            s = Store(os.path.join(d, "objects"))
            h = put_blob(s, b"hello\n")
            self.assertEqual(h.hex(), "ce013625030ba8dba906f756967f9e9ca394464a")
            data = get_blob(s, h)
            self.assertEqual(data, b"hello\n")
            typ, _ = s.get(h)
            self.assertEqual(typ, "blob")

    def test_tree_commit_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            s = Store(os.path.join(d, "objects"))
            bh = put_blob(s, b"x")
            th = put_tree(
                s,
                [
                    TreeEntry(mode=MODE_FILE, name="a.txt", hash=bh),
                    TreeEntry(mode=MODE_FILE, name="b.txt", hash=bh),
                ],
            )
            entries = get_tree(s, th)
            self.assertEqual(len(entries), 2)
            self.assertEqual(entries[0].name, "a.txt")
            self.assertEqual(entries[1].name, "b.txt")
            ch = put_commit(
                s,
                Commit(tree=th, author="A <a@b> 1 +0000", message="first\n"),
            )
            c = get_commit(s, ch)
            self.assertEqual(c.tree, th)
            self.assertEqual(c.message, "first\n")
            self.assertEqual(c.author, "A <a@b> 1 +0000")
            path = os.path.join(s.dir, ch.hex()[:2], ch.hex()[2:])
            self.assertTrue(os.path.isfile(path))


if __name__ == "__main__":
    unittest.main()
