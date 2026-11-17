#include "check.h"
#include "iterator/merging.h"
#include "memtable/iterator.h"
#include "memtable/memtable.h"

#include <memory>
#include <string>
#include <vector>

using namespace lsmkv;

static it::Cursor FromMem(std::shared_ptr<Iterator> it) {
  it::Cursor c;
  c.SeekToFirst = [it] { it->SeekToFirst(); };
  c.Seek = [it](std::string_view t) { it->Seek(t); };
  c.Valid = [it] { return it->Valid(); };
  c.Next = [it] { it->Next(); };
  c.Key = [it] { return it->Key(); };
  c.Value = [it] { return it->Value(); };
  c.kind = [it] { return it->kind(); };
  return c;
}

TEST(MergesAndKeepsNewest) {
  Memtable a, b;
  a.Put("k1", "old");
  a.Put("k2", "a2");
  b.Put("k1", "new");
  b.Put("k3", "b3");
  auto bi = std::make_shared<Iterator>(b.NewIterator());
  auto ai = std::make_shared<Iterator>(a.NewIterator());
  std::vector<it::Cursor> children;
  children.push_back(FromMem(bi));  // newer first
  children.push_back(FromMem(ai));
  it::Merging m(std::move(children));
  m.SeekToFirst();
  std::vector<std::string> keys, values;
  for (; m.Valid(); m.Next()) {
    keys.emplace_back(m.Key());
    values.emplace_back(m.Value());
  }
  CHECK_EQ(keys.size(), 3u);
  CHECK_EQ(keys[0], "k1");
  CHECK_EQ(values[0], "new");
  CHECK_EQ(keys[1], "k2");
  CHECK_EQ(values[1], "a2");
  CHECK_EQ(keys[2], "k3");
  CHECK_EQ(values[2], "b3");
}

TEST(TombstoneReturned) {
  Memtable a, b;
  a.Put("k", "v");
  b.Delete("k");
  auto bi = std::make_shared<Iterator>(b.NewIterator());
  auto ai = std::make_shared<Iterator>(a.NewIterator());
  std::vector<it::Cursor> children;
  children.push_back(FromMem(bi));
  children.push_back(FromMem(ai));
  it::Merging m(std::move(children));
  m.SeekToFirst();
  CHECK(m.Valid());
  CHECK(m.kind() == Kind::kTombstone);
}

int main() { return check::RunAll(); }
