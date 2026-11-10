import os
import tempfile
import unittest

from tinygit.index.add import add
from tinygit.object.commit import get_commit
from tinygit.object.tree import get_tree
from tinygit.ref.head import read_head, resolve_head
from tinygit.repo import init
from tinygit.worktree.checkout import checkout
from tinygit.worktree.commit import CommitOpts, commit


class TestWorktree(unittest.TestCase):
    def test_commit_checkout_round_trip(self):
        with tempfile.TemporaryDirectory() as root:
            r = init(root)
            os.makedirs(os.path.join(root, "dir"), exist_ok=True)
            with open(os.path.join(root, "dir", "a.txt"), "wb") as f:
                f.write(b"hello\n")
            add(r, "dir/a.txt")
            h = commit(r, CommitOpts(message="init"))
            with open(os.path.join(root, "dir", "a.txt"), "wb") as f:
                f.write(b"changed\n")
            checkout(r, h)
            with open(os.path.join(root, "dir", "a.txt"), "rb") as f:
                data = f.read()
            self.assertEqual(data, b"hello\n")
            tip = resolve_head(r)
            if tip != h:
                hd = read_head(r)
                self.assertEqual(hd.hash, h)
            c = get_commit(r.objects(), h)
            entries = get_tree(r.objects(), c.tree)
            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0].name, "dir")


if __name__ == "__main__":
    unittest.main()
