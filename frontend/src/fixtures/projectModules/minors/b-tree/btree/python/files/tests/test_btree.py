"""Acceptance tests for the B+ tree."""

from __future__ import annotations

import os
import random
import tempfile
import unittest

from btreekv.btree import (
    ErrEmptyKey,
    ErrKeyTooLarge,
    ErrValueTooLarge,
    Tree,
)
from btreekv.btree.node import MAX_KEY_SIZE, MAX_VALUE_SIZE, Node, decode
from btreekv.pager import Pager
from btreekv.pager.page import PAGE_SIZE

from memio import MemIO


def key(i: int) -> bytes:
    return f"key-{i:06d}".encode()


def val(i: int, size: int) -> bytes:
    return f"val-{i}-".encode() + b"x" * size


class BTreeTest(unittest.TestCase):
    def check(self, tr: Tree):
        return tr.check()

    def must_get(self, tr: Tree, k: bytes, want: bytes | None) -> None:
        got, ok = tr.get(k)
        if want is None:
            self.assertFalse(ok, f"Get({k!r}) = {got!r}, want absent")
            return
        self.assertTrue(ok)
        self.assertEqual(got, want)

    def test_child_index(self) -> None:
        n = Node(keys=[b"b", b"d", b"f"])
        for k, want in [("a", 0), ("b", 1), ("c", 1), ("d", 2), ("e", 2), ("f", 3), ("z", 3)]:
            self.assertEqual(n.child_index(k.encode()), want, f"child_index({k})")
        self.assertEqual(Node().child_index(b"a"), 0)

    def test_leaf_index(self) -> None:
        n = Node(leaf=True, keys=[b"b", b"d"], vals=[b"", b""])
        for k, at, found in [("a", 0, False), ("b", 0, True), ("c", 1, False), ("d", 1, True), ("e", 2, False)]:
            got_at, got_found = n.leaf_index(k.encode())
            self.assertEqual((got_at, got_found), (at, found), f"leaf_index({k})")

    def test_leaf_put(self) -> None:
        n = Node(leaf=True)
        for k in ["m", "c", "x", "a", "m"]:
            n.leaf_put(k.encode(), f"v-{k}".encode())
        n.leaf_put(b"c", b"new")
        got = " ".join(f"{k.decode()}={v.decode()}" for k, v in zip(n.keys, n.vals))
        self.assertEqual(got, "a=v-a c=new m=v-m x=v-x")

    def big_leaf(self, count: int, val_size: int) -> Node:
        n = Node(leaf=True, next=77)
        for i in range(count):
            n.keys.append(key(i))
            n.vals.append(val(i, val_size))
        return n

    def test_split_leaf(self) -> None:
        n = self.big_leaf(30, 200)
        self.assertFalse(n.fits())
        orig = len(n.keys)
        right, sep = n.split()
        self.assertTrue(n.fits() and right.fits())
        self.assertEqual(len(n.keys) + len(right.keys), orig)
        self.assertEqual(len(n.vals), len(n.keys))
        self.assertEqual(len(right.vals), len(right.keys))
        self.assertTrue(n.keys and right.keys)
        self.assertEqual(sep, right.keys[0])
        self.assertTrue(right.leaf)
        self.assertEqual(right.next, 77)
        self.assertLessEqual(abs(n.size() - right.size()), 1200)

    def test_split_internal(self) -> None:
        n = Node()
        for i in range(60):
            n.keys.append(f"{i:0100d}".encode())
        for i in range(61):
            n.children.append(100 + i)
        self.assertFalse(n.fits())
        keys, children = len(n.keys), len(n.children)
        all_keys = list(n.keys)
        right, sep = n.split()
        self.assertTrue(n.fits() and right.fits())
        self.assertEqual(len(n.children), len(n.keys) + 1)
        self.assertEqual(len(right.children), len(right.keys) + 1)
        self.assertEqual(len(n.keys) + len(right.keys) + 1, keys)
        self.assertEqual(len(n.children) + len(right.children), children)
        self.assertEqual(sep, all_keys[len(n.keys)])
        self.assertEqual(n.children[-1], 100 + len(n.keys))
        self.assertEqual(right.children[0], 100 + len(n.keys) + 1)
        self.assertFalse(right.leaf)

    def test_node_round_trip(self) -> None:
        buf = bytearray(PAGE_SIZE)
        leaf = self.big_leaf(10, 100)
        leaf.encode(buf)
        got = decode(buf)
        self.assertTrue(got.leaf and got.next == 77 and len(got.keys) == 10)
        self.assertEqual(got.vals[9], leaf.vals[9])
        inn = Node(keys=[b"m", b"t"], children=[3, 4, 5])
        inn.encode(buf)
        got = decode(buf)
        self.assertFalse(got.leaf)
        self.assertEqual(got.children, [3, 4, 5])

    def test_empty_tree(self) -> None:
        tr = Tree(MemIO())
        self.must_get(tr, key(1), None)
        self.assertEqual(self.check(tr).height, 0)

    def test_insert_get_overwrite(self) -> None:
        tr = Tree(MemIO())
        for k in [5, 1, 9, 3]:
            tr.insert(key(k), val(k, 4))
        tr.insert(key(3), b"replaced")
        self.must_get(tr, key(1), val(1, 4))
        self.must_get(tr, key(3), b"replaced")
        self.must_get(tr, key(9), val(9, 4))
        self.must_get(tr, key(2), None)
        st = self.check(tr)
        self.assertEqual(st.height, 1)
        self.assertEqual(st.keys, 4)

    def test_first_split_grows_the_tree(self) -> None:
        tr = Tree(MemIO())
        n = 0
        while True:
            tr.insert(key(n), val(n, 300))
            st = self.check(tr)
            if st.height == 2:
                self.assertEqual(st.leaves, 2)
                self.assertEqual(st.internal, 1)
                self.assertEqual(st.keys, n + 1)
                break
            self.assertLessEqual(n, 100)
            n += 1
        for i in range(n + 1):
            self.must_get(tr, key(i), val(i, 300))

    def test_sequential_inserts(self) -> None:
        tr = Tree(MemIO())
        n = 4000
        for i in range(n):
            tr.insert(key(i), val(i, 20))
        st = self.check(tr)
        self.assertEqual(st.keys, n)
        self.assertGreaterEqual(st.height, 2)
        for i in range(n):
            self.must_get(tr, key(i), val(i, 20))
        self.must_get(tr, b"zzz", None)

    def test_random_inserts(self) -> None:
        tr = Tree(MemIO())
        rng = random.Random(1)
        order = list(range(5000))
        rng.shuffle(order)
        for i in order:
            tr.insert(key(i), val(i, 30))
        self.assertEqual(self.check(tr).keys, 5000)
        for i in range(5000):
            self.must_get(tr, key(i), val(i, 30))

    def test_overwrite_that_grows_the_leaf_splits(self) -> None:
        tr = Tree(MemIO())
        for i in range(40):
            tr.insert(key(i), val(i, 10))
        for i in range(40):
            tr.insert(key(i), val(i, 900))
        self.check(tr)
        for i in range(40):
            self.must_get(tr, key(i), val(i, 900))

    def test_internal_nodes_split_too(self) -> None:
        tr = Tree(MemIO())
        n = 3000

        def big(i: int) -> bytes:
            return f"{i:0120d}".encode()

        for i in range(n):
            tr.insert(big(i), val(i, 1000))
        st = self.check(tr)
        self.assertGreaterEqual(st.height, 3)
        for i in range(0, n, 7):
            self.must_get(tr, big(i), val(i, 1000))

    def test_get_reads_one_page_per_level(self) -> None:
        io = MemIO()
        tr = Tree(io)
        for i in range(20000):
            tr.insert(key(i), val(i, 8))
        st = self.check(tr)
        io.reads = 0
        self.must_get(tr, key(12345), val(12345, 8))
        self.assertEqual(io.reads, st.height)
        io.reads = 0
        self.must_get(tr, b"nope", None)
        self.assertLessEqual(io.reads, st.height)

    def test_entry_limits(self) -> None:
        tr = Tree(MemIO())
        with self.assertRaises(ErrEmptyKey):
            tr.insert(b"", b"v")
        with self.assertRaises(ErrKeyTooLarge):
            tr.insert(b"k" * (MAX_KEY_SIZE + 1), b"")
        with self.assertRaises(ErrValueTooLarge):
            tr.insert(b"k", bytes(MAX_VALUE_SIZE + 1))
        tr.insert(b"k" * MAX_KEY_SIZE, bytes(MAX_VALUE_SIZE))

    def test_empty_value_and_binary_keys(self) -> None:
        tr = Tree(MemIO())
        tr.insert(bytes([0, 0, 1]), b"")
        tr.insert(bytes([0, 255]), bytes([0, 0]))
        v, ok = tr.get(bytes([0, 0, 1]))
        self.assertTrue(ok and len(v) == 0)
        self.must_get(tr, bytes([0, 255]), bytes([0, 0]))

    def test_tree_over_the_real_pager(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Pager.open(os.path.join(td, "data.db"))
            try:
                tr = Tree(p)
                for i in range(2000):
                    tr.insert(key(i), val(i, 50))
                self.check(tr)
                for i in range(0, 2000, 13):
                    self.must_get(tr, key(i), val(i, 50))
            finally:
                p.close()


if __name__ == "__main__":
    unittest.main()
