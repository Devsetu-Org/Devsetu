#include "btree/tree.h"
#include "memio.h"
#include "check.h"

#include <algorithm>
#include <cstdio>
#include <random>
#include <string>

using namespace btreekv;

static std::string Key(int i) {
  char buf[32];
  std::snprintf(buf, sizeof(buf), "key-%06d", i);
  return buf;
}
static std::string Val(int i, int size) {
  return "val-" + std::to_string(i) + "-" + std::string(size, 'x');
}

static void MustGet(Tree& tr, const std::string& k, const std::string* want) {
  std::string got;
  bool ok = tr.Get(k, &got);
  if (want == nullptr) {
    CHECK(!ok);
    return;
  }
  CHECK(ok);
  CHECK(got == *want);
}

TEST(TestChildIndex) {
  Node n;
  n.keys = {"b", "d", "f"};
  CHECK(ChildIndex(n, "a") == 0);
  CHECK(ChildIndex(n, "b") == 1);
  CHECK(ChildIndex(n, "c") == 1);
  CHECK(ChildIndex(n, "d") == 2);
  CHECK(ChildIndex(n, "f") == 3);
  CHECK(ChildIndex(n, "z") == 3);
  CHECK(ChildIndex(Node{}, "a") == 0);
}

TEST(TestLeafIndex) {
  Node n;
  n.leaf = true;
  n.keys = {"b", "d"};
  n.vals = {"", ""};
  auto [a0, f0] = LeafIndex(n, "a");
  CHECK(a0 == 0 && !f0);
  auto [a1, f1] = LeafIndex(n, "b");
  CHECK(a1 == 0 && f1);
  auto [a2, f2] = LeafIndex(n, "e");
  CHECK(a2 == 2 && !f2);
}

TEST(TestLeafPut) {
  Node n;
  n.leaf = true;
  for (const char* k : {"m", "c", "x", "a", "m"}) LeafPut(n, k, std::string("v-") + k);
  LeafPut(n, "c", "new");
  CHECK(n.keys.size() == 4);
  CHECK(n.keys[0] == "a" && n.vals[0] == "v-a");
  CHECK(n.keys[1] == "c" && n.vals[1] == "new");
}

TEST(TestSplitLeaf) {
  Node n;
  n.leaf = true;
  n.next = 77;
  for (int i = 0; i < 30; ++i) {
    n.keys.push_back(Key(i));
    n.vals.push_back(Val(i, 200));
  }
  CHECK(!n.Fits());
  int orig = int(n.keys.size());
  auto [right, sep] = Split(n);
  CHECK(n.Fits() && right.Fits());
  CHECK(int(n.keys.size() + right.keys.size()) == orig);
  CHECK(sep == right.keys[0]);
  CHECK(right.leaf && right.next == 77);
}

TEST(EmptyTree) {
  MemIO io;
  Tree tr(&io);
  MustGet(tr, Key(1), nullptr);
  CHECK(tr.Check().height == 0);
}

TEST(InsertGetOverwrite) {
  MemIO io;
  Tree tr(&io);
  for (int k : {5, 1, 9, 3}) {
    auto v = Val(k, 4);
    tr.Insert(Key(k), v);
  }
  tr.Insert(Key(3), "replaced");
  auto v1 = Val(1, 4);
  MustGet(tr, Key(1), &v1);
  std::string rep = "replaced";
  MustGet(tr, Key(3), &rep);
  MustGet(tr, Key(2), nullptr);
  auto st = tr.Check();
  CHECK(st.height == 1 && st.keys == 4);
}

TEST(FirstSplitGrowsTheTree) {
  MemIO io;
  Tree tr(&io);
  int n = 0;
  for (;; ++n) {
    tr.Insert(Key(n), Val(n, 300));
    auto st = tr.Check();
    if (st.height == 2) {
      CHECK(st.leaves == 2 && st.internal == 1 && st.keys == n + 1);
      break;
    }
    CHECK(n <= 100);
  }
  for (int i = 0; i <= n; ++i) {
    auto v = Val(i, 300);
    MustGet(tr, Key(i), &v);
  }
}

TEST(SequentialInserts) {
  MemIO io;
  Tree tr(&io);
  const int n = 4000;
  for (int i = 0; i < n; ++i) tr.Insert(Key(i), Val(i, 20));
  auto st = tr.Check();
  CHECK(st.keys == n && st.height >= 2);
  for (int i = 0; i < n; ++i) {
    auto v = Val(i, 20);
    MustGet(tr, Key(i), &v);
  }
}

TEST(RandomInserts) {
  MemIO io;
  Tree tr(&io);
  std::mt19937 rng(1);
  std::vector<int> order(5000);
  for (int i = 0; i < 5000; ++i) order[i] = i;
  std::shuffle(order.begin(), order.end(), rng);
  for (int i : order) tr.Insert(Key(i), Val(i, 30));
  CHECK(tr.Check().keys == 5000);
  for (int i = 0; i < 5000; ++i) {
    auto v = Val(i, 30);
    MustGet(tr, Key(i), &v);
  }
}

TEST(GetReadsOnePagePerLevel) {
  MemIO io;
  Tree tr(&io);
  for (int i = 0; i < 20000; ++i) tr.Insert(Key(i), Val(i, 8));
  auto st = tr.Check();
  io.reads = 0;
  auto v = Val(12345, 8);
  MustGet(tr, Key(12345), &v);
  CHECK(io.reads == st.height);
}

TEST(EntryLimits) {
  MemIO io;
  Tree tr(&io);
  bool empty = false, bigk = false, bigv = false;
  try { tr.Insert("", "v"); } catch (const EmptyKeyError&) { empty = true; }
  try { tr.Insert(std::string(kMaxKeySize + 1, 'k'), ""); } catch (const KeyTooLargeError&) { bigk = true; }
  try { tr.Insert("k", std::string(kMaxValueSize + 1, 'x')); } catch (const ValueTooLargeError&) { bigv = true; }
  CHECK(empty && bigk && bigv);
  tr.Insert(std::string(kMaxKeySize, 'k'), std::string(kMaxValueSize, 'x'));
}

int main() { return check::RunAll(); }
