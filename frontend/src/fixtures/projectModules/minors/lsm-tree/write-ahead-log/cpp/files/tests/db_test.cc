#include <cstdio>
#include <filesystem>
#include <fstream>
#include <map>
#include <random>
#include <string>
#include <thread>
#include <vector>

#include "check.h"
#include "db/db.h"

namespace fs = std::filesystem;
using lsmkv::db::DB;
using lsmkv::db::ErrClosed;
using lsmkv::db::Open;
using lsmkv::db::Options;
using lsmkv::wal::SyncMode;

namespace {

std::string TmpDir() {
  auto p = fs::temp_directory_path() / ("lsmkv-db-" + std::to_string(rand()));
  fs::create_directories(p);
  return p.string();
}

std::unique_ptr<DB> OpenNever(const std::string& dir) {
  Options opts;
  opts.sync = SyncMode::kNever;
  return Open(dir, opts);
}

void MustGet(DB* d, const std::string& key, const std::string& want, bool want_ok) {
  std::string v;
  bool ok = d->Get(key, &v);
  CHECK_EQ(ok, want_ok);
  if (want_ok) CHECK_EQ(v, want);
}

}  // namespace

TEST(PutDeleteGet) {
  std::string dir = TmpDir();
  auto d = OpenNever(dir);
  d->Put("order:1", "pending");
  d->Put("order:2", "paid");
  d->Delete("order:1");
  MustGet(d.get(), "order:1", "", false);
  MustGet(d.get(), "order:2", "paid", true);
  MustGet(d.get(), "order:3", "", false);
  d->Close();
  fs::remove_all(dir);
}

TEST(ReopenRecoversEverything) {
  std::string dir = TmpDir();
  {
    auto d = OpenNever(dir);
    d->Put("order:1", "pending");
    d->Put("order:1", "paid");
    d->Put("order:2", "pending");
    d->Delete("order:2");
    d->Close();
  }
  auto d = OpenNever(dir);
  MustGet(d.get(), "order:1", "paid", true);
  MustGet(d.get(), "order:2", "", false);
  CHECK_EQ(d->GetStats().memtable_entries, size_t{2});
  d->Close();
  fs::remove_all(dir);
}

TEST(WithoutCloseNothingIsLost) {
  std::string dir = TmpDir();
  auto d = OpenNever(dir);
  d->Put("k", "v");
  auto d2 = OpenNever(dir);
  MustGet(d2.get(), "k", "v", true);
  d2->Close();
  fs::remove_all(dir);
}

TEST(TornTailIsCutBeforeNewWrites) {
  std::string dir = TmpDir();
  {
    auto d = OpenNever(dir);
    d->Put("a", "1");
    d->Put("b", "2");
    d->Close();
  }
  {
    std::ofstream out(dir + "/wal.log", std::ios::binary | std::ios::app);
    const char garbage[] = {'\xde', '\xad', '\xbe', '\xef', 0x40, 0, 0, 0, 1, 2};
    out.write(garbage, sizeof(garbage));
  }
  {
    auto d = OpenNever(dir);
    MustGet(d.get(), "a", "1", true);
    MustGet(d.get(), "b", "2", true);
    d->Put("c", "3");
    d->Close();
  }
  auto d = OpenNever(dir);
  MustGet(d.get(), "c", "3", true);
  d->Close();
  fs::remove_all(dir);
}

TEST(WriteFailsAfterClose) {
  std::string dir = TmpDir();
  auto d = OpenNever(dir);
  d->Close();
  bool threw = false;
  try {
    d->Put("k", "v");
  } catch (const ErrClosed&) {
    threw = true;
  }
  CHECK(threw);
  fs::remove_all(dir);
}

TEST(RandomOpsSurviveReopen) {
  std::string dir = TmpDir();
  std::map<std::string, std::string> model;
  std::mt19937 rnd(7);
  auto d = OpenNever(dir);
  for (int round = 0; round < 5; ++round) {
    for (int i = 0; i < 400; ++i) {
      char key[32];
      std::snprintf(key, sizeof(key), "key:%03d", int(rnd() % 150));
      if (rnd() % 4 == 0) {
        d->Delete(key);
        model.erase(key);
      } else {
        std::string v = "v" + std::to_string(rnd());
        d->Put(key, v);
        model[key] = v;
      }
    }
    d->Close();
    d = OpenNever(dir);
    for (int i = 0; i < 150; ++i) {
      char key[32];
      std::snprintf(key, sizeof(key), "key:%03d", i);
      auto it = model.find(key);
      if (it == model.end()) {
        MustGet(d.get(), key, "", false);
      } else {
        MustGet(d.get(), key, it->second, true);
      }
    }
  }
  d->Close();
  fs::remove_all(dir);
}

TEST(ConcurrentWriters) {
  std::string dir = TmpDir();
  auto d = OpenNever(dir);
  std::vector<std::thread> threads;
  for (int g = 0; g < 8; ++g) {
    threads.emplace_back([d = d.get(), g] {
      for (int i = 0; i < 200; ++i) {
        char key[32];
        std::snprintf(key, sizeof(key), "g%d:%03d", g, i);
        d->Put(key, "v");
      }
    });
  }
  for (auto& t : threads) t.join();
  d->Close();
  d = OpenNever(dir);
  CHECK_EQ(d->GetStats().memtable_entries, size_t{1600});
  d->Close();
  fs::remove_all(dir);
}

int main() { return check::RunAll(); }
