#include "db/db.h"
#include "check.h"

#include <cstdio>
#include <cstdlib>
#include <unistd.h>
#include <filesystem>
#include <string>
#include <thread>
#include <vector>

using namespace btreekv;

static std::string TmpDir() {
  auto p = std::filesystem::temp_directory_path() / ("btreekv-db-" + std::to_string(::getpid()) + "-" + std::to_string(rand()));
  std::filesystem::create_directories(p);
  return p.string();
}

TEST(PutGetOverwrite) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    d.Put("order:1", "pending");
    d.Put("order:2", "paid");
    d.Put("order:1", "shipped");
    std::string v;
    CHECK(d.Get("order:1", &v) && v == "shipped");
    CHECK(d.Get("order:2", &v) && v == "paid");
    CHECK(!d.Get("order:3", &v));
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(ManyKeysSplitTheTree) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    const int n = 3000;
    for (int i = 0; i < n; ++i) {
      char k[32], v[32];
      std::snprintf(k, sizeof(k), "user:%05d", (i * 7919) % n);
      std::snprintf(v, sizeof(v), "name-%d", i);
      d.Put(k, v);
    }
    auto s = d.Stats();
    CHECK(s.keys == n && s.height >= 2);
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(ReopenKeepsEverything) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    for (int i = 0; i < 1500; ++i) {
      char k[16], v[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      std::snprintf(v, sizeof(v), "v%d", i);
      d.Put(k, v);
    }
    d.Close();
  }
  {
    DB d = DB::Open(dir);
    for (int i = 0; i < 1500; i += 11) {
      char k[16], want[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      std::snprintf(want, sizeof(want), "v%d", i);
      std::string v;
      CHECK(d.Get(k, &v) && v == want);
    }
    CHECK(d.Stats().keys == 1500);
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(ClosedDB) {
  std::string dir = TmpDir();
  DB d = DB::Open(dir);
  d.Close();
  bool put = false, get = false, close = false;
  try { d.Put("k", "v"); } catch (const ClosedError&) { put = true; }
  try { std::string v; d.Get("k", &v); } catch (const ClosedError&) { get = true; }
  try { d.Close(); } catch (const ClosedError&) { close = true; }
  CHECK(put && get && close);
  std::filesystem::remove_all(dir);
}

int main() { return check::RunAll(); }
