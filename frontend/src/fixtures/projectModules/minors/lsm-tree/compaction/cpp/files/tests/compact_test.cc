#include "check.h"
#include "db/db.h"
#include "manifest/manifest.h"
#include "sstable/iterator.h"

#include <cstdio>
#include <cstdlib>
#include <dirent.h>
#include <fstream>
#include <string>
#include <unistd.h>
#include <vector>

using namespace lsmkv::db;

static std::string TempDir() {
  std::string buf = "/tmp/lsmkv-cmp-XXXXXX";
  buf.push_back('\0');
  if (!mkdtemp(buf.data())) throw std::runtime_error("mkdtemp");
  buf.pop_back();
  return buf;
}

static std::unique_ptr<DB> OpenWith(const std::string& dir, int trigger) {
  Options o;
  o.sync = lsmkv::wal::SyncMode::kNever;
  o.memtable_size = 4 << 10;
  o.block_size = 512;
  o.compaction_trigger = trigger;
  return Open(dir, o);
}

static std::vector<uint64_t> LiveTables(const std::string& dir) {
  return lsmkv::manifest::Load(dir).tables;
}

static int CountSst(const std::string& dir) {
  DIR* d = opendir(dir.c_str());
  if (!d) return -1;
  int n = 0;
  while (dirent* e = readdir(d)) {
    std::string name = e->d_name;
    if (name.size() > 4 && name.substr(name.size() - 4) == ".sst") ++n;
  }
  closedir(d);
  return n;
}

static int CountTombstones(DB* d) {
  int n = 0;
  for (auto& tb : d->tables_) {
    auto it = tb.t->NewIterator();
    for (it.SeekToFirst(); it.Valid(); it.Next()) {
      if (it.kind() == lsmkv::Kind::kTombstone) ++n;
    }
  }
  return n;
}

static void MustGet(DB* d, const std::string& k, const std::string& want, bool present) {
  std::string v;
  bool ok = d->Get(k, &v);
  CHECK_EQ(ok, present);
  if (present) CHECK_EQ(v, want);
}

TEST(CompactMergesEverythingIntoOneTable) {
  auto dir = TempDir();
  auto d = OpenWith(dir, -1);
  for (int round = 0; round < 4; ++round) {
    for (int i = 0; i < 50; ++i) {
      char k[16], v[16];
      std::snprintf(k, sizeof(k), "order:%03d", i);
      std::snprintf(v, sizeof(v), "v%d", round);
      d->Put(k, v);
    }
    char del[16];
    std::snprintf(del, sizeof(del), "order:%03d", round);
    d->Delete(del);
    d->Flush();
  }
  CHECK_EQ(d->GetStats().tables, 4);
  d->Compact();
  CHECK_EQ(d->GetStats().tables, 1);
  CHECK_EQ(CountSst(dir), 1);
  auto live = LiveTables(dir);
  CHECK_EQ(live.size(), 1u);
  CHECK_EQ(live[0], 5u);
  CHECK_EQ(CountTombstones(d.get()), 0);
  for (int i = 0; i < 50; ++i) {
    char k[16];
    std::snprintf(k, sizeof(k), "order:%03d", i);
    MustGet(d.get(), k, "v3", i != 3);
  }
  d->Close();
  d = OpenWith(dir, -1);
  MustGet(d.get(), "order:010", "v3", true);
  MustGet(d.get(), "order:003", "", false);
  d->Close();
}

TEST(PartialCompactionKeepsTombstones) {
  auto dir = TempDir();
  auto d = OpenWith(dir, -1);
  d->Put("order:1", "pending");
  d->Flush();
  d->Delete("order:1");
  d->Flush();
  d->Put("order:2", "paid");
  d->Flush();
  d->compactRange(0, 2);
  CHECK_EQ(d->GetStats().tables, 2);
  MustGet(d.get(), "order:1", "", false);
  MustGet(d.get(), "order:2", "paid", true);
  CHECK_EQ(CountTombstones(d.get()), 1);
  d->Close();
}

TEST(CompactionOutputKeepsItsPlace) {
  auto dir = TempDir();
  auto d = OpenWith(dir, -1);
  d->Put("k", "oldest");
  d->Flush();
  d->Put("k", "middle");
  d->Flush();
  d->Put("k", "newest");
  d->Flush();
  d->compactRange(1, 3);
  MustGet(d.get(), "k", "newest", true);
  auto live = LiveTables(dir);
  CHECK_EQ(live.size(), 2u);
  CHECK_EQ(live[0], 3u);
  CHECK_EQ(live[1], 4u);
  d->Close();
  d = OpenWith(dir, -1);
  MustGet(d.get(), "k", "newest", true);
  d->Close();
}

TEST(AutomaticCompaction) {
  auto dir = TempDir();
  auto d = OpenWith(dir, 4);
  for (int i = 0; i < 5000; ++i) {
    char k[24], v[24];
    std::snprintf(k, sizeof(k), "order:%04d", i % 700);
    std::snprintf(v, sizeof(v), "v%d", i);
    d->Put(k, v);
    CHECK(d->GetStats().tables < 4);
  }
  CHECK(d->GetStats().compactions > 0);
  d->Close();
}

TEST(CrashLeftoversAreCleanedUp) {
  auto dir = TempDir();
  auto d = OpenWith(dir, -1);
  d->Put("a", "1");
  d->Flush();
  d->Close();
  {
    std::ofstream out(dir + "/000009.sst");
    out << "uncommitted";
  }
  {
    std::ofstream out(dir + "/000010.sst.tmp");
    out << "half";
  }
  {
    std::ofstream out(dir + "/" + std::string(lsmkv::manifest::kFileName) + ".tmp");
    out << "half";
  }
  d = OpenWith(dir, -1);
  MustGet(d.get(), "a", "1", true);
  CHECK_EQ(CountSst(dir), 1);
  d->Close();
}

int main() { return check::RunAll(); }
