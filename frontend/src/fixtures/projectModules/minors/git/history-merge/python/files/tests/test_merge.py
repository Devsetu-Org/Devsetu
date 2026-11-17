import os
import tempfile
import unittest

from tinygit.diff.diff import tree_diff
from tinygit.diff.log import log_walk
from tinygit.index.add import add
from tinygit.merge.base import merge_base
from tinygit.merge.merge import MARKER_OURS, MARKER_THEIRS, merge
from tinygit.object.commit import get_commit
from tinygit.object.hash import Hash
from tinygit.ref.ref import write
from tinygit.repo import Repo, init
from tinygit.worktree.checkout import checkout_branch
from tinygit.worktree.commit import CommitOpts, commit


def commit_file(r: Repo, path: str, content: str, msg: str) -> Hash:
    abs_path = os.path.join(r.root, *path.split("/"))
    parent = os.path.dirname(abs_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(abs_path, "wb") as f:
        f.write(content.encode())
    add(r, path)
    return commit(r, CommitOpts(message=msg))


class TestMerge(unittest.TestCase):
    def test_log_diff_merge(self):
        with tempfile.TemporaryDirectory() as root:
            r = init(root)
            base = commit_file(r, "f.txt", "base\n", "base")
            write(r, "refs/heads/feature", base)
            checkout_branch(r, "feature")
            feature = commit_file(r, "f.txt", "feature\n", "feature")
            checkout_branch(r, "main")
            main = commit_file(r, "f.txt", "main\n", "main")

            _, hashes = log_walk(r.objects(), main)
            self.assertGreaterEqual(len(hashes), 2)

            oc = get_commit(r.objects(), main)
            tc = get_commit(r.objects(), feature)
            changes = tree_diff(r.objects(), oc.tree, tc.tree)
            self.assertEqual(len(changes), 1)
            self.assertEqual(changes[0].path, "f.txt")

            mb = merge_base(r.objects(), main, feature)
            self.assertEqual(mb, base)

            with self.assertRaises(ValueError) as cm:
                merge(r, "feature")
            self.assertIn("conflict", str(cm.exception))
            with open(os.path.join(root, "f.txt"), "rb") as f:
                data = f.read().decode()
            self.assertIn(MARKER_OURS, data)
            self.assertIn(MARKER_THEIRS, data)

    def test_fast_forward(self):
        with tempfile.TemporaryDirectory() as root:
            r = init(root)
            base = commit_file(r, "a.txt", "1\n", "base")
            write(r, "refs/heads/feature", base)
            checkout_branch(r, "feature")
            tip = commit_file(r, "a.txt", "2\n", "feat")
            checkout_branch(r, "main")
            res = merge(r, "feature")
            self.assertTrue(res.fast_forward)
            self.assertEqual(res.commit, tip)
            with open(os.path.join(root, "a.txt"), "rb") as f:
                self.assertEqual(f.read(), b"2\n")

    def test_clean_merge(self):
        with tempfile.TemporaryDirectory() as root:
            r = init(root)
            base = commit_file(r, "shared.txt", "s\n", "base")
            write(r, "refs/heads/feature", base)
            checkout_branch(r, "feature")
            commit_file(r, "feat.txt", "f\n", "feat")
            checkout_branch(r, "main")
            commit_file(r, "main.txt", "m\n", "main")
            res = merge(r, "feature")
            self.assertFalse(res.fast_forward)
            self.assertEqual(res.conflicts, [])
            self.assertFalse(res.commit.is_zero())
            for p in ("shared.txt", "feat.txt", "main.txt"):
                self.assertTrue(os.path.isfile(os.path.join(root, p)))


if __name__ == "__main__":
    unittest.main()
