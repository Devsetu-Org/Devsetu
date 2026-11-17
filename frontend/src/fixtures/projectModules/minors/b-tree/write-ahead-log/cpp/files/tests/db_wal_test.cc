#include "db/db.h"
#include "check.h"

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <unistd.h>

using namespace btreekv;

static std::string TmpDir() {
  auto p = std::filesystem::temp_directory_path() /
           ("btreekv-dbwal-" + std::to_string(::getpid()) + "-" + std::to_string(rand()));
  std::filesystem::create_directories(p);
  return p.string();
}

TEST(PutSurvivesReopen) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    d.Put("a", "1");
    d.Put("b", "2");
    d.Close();
  }
  {
    DB d = DB::Open(dir);
    std::string v;
    CHECK(d.Get("a", &v) && v == "1");
    CHECK(d.Get("b", &v) && v == "2");
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(CrashBeforeCloseKeepsCommitted) {
  // SyncAlways: Put durability is in the WAL before Close. Copy the dir after Put,
  // Close the original (checkpoint), restore the pre-close snapshot, reopen.
  std::string dir = TmpDir();
  std::string snap = dir + "-snap";
  {
    Options opts;
    opts.sync = SyncMode::kAlways;
    DB d = DB::Open(dir, opts);
    d.Put("k", "v");
    std::filesystem::create_directories(snap);
    std::filesystem::copy(dir + "/data.db", snap + "/data.db");
    std::filesystem::copy(dir + "/wal.log", snap + "/wal.log");
    d.Close();
  }
  std::filesystem::remove_all(dir);
  std::filesystem::rename(snap, dir);
  {
    DB d = DB::Open(dir);
    std::string v;
    CHECK(d.Get("k", &v) && v == "v");
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(ManyPutsWithWal) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    for (int i = 0; i < 500; ++i) {
      char k[16], v[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      std::snprintf(v, sizeof(v), "v%d", i);
      d.Put(k, v);
    }
    auto s = d.Stats();
    CHECK(s.keys == 500);
    CHECK(s.wal_bytes > 0);
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

int main() { return check::RunAll(); }
