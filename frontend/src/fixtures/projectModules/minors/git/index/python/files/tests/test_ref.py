import tempfile
import unittest

from tinygit.object.hash import hash_of
from tinygit.ref.head import read_head, resolve_head, write_detached_head
from tinygit.ref.ref import read, write
from tinygit.ref.update import update_ref
from tinygit.repo import init


class TestRef(unittest.TestCase):
    def test_refs_and_head(self):
        with tempfile.TemporaryDirectory() as root:
            r = init(root)
            h = hash_of(b"commit-ish")
            write(r, "refs/heads/main", h)
            got = read(r, "refs/heads/main")
            self.assertEqual(got, h)
            hd = read_head(r)
            self.assertEqual(hd.symbolic, "refs/heads/main")
            res = resolve_head(r)
            self.assertEqual(res, h)
            h2 = hash_of(b"other")
            update_ref(r, "HEAD", h2, h)
            got = read(r, "refs/heads/main")
            self.assertEqual(got, h2)
            write_detached_head(r, h)
            hd = read_head(r)
            self.assertEqual(hd.symbolic, "")
            self.assertEqual(hd.hash, h)


if __name__ == "__main__":
    unittest.main()
