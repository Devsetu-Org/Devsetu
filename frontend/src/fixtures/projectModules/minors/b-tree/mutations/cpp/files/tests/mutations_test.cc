#include "db/db.h"
#include "check.h"

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <unistd.h>
#include <vector>

using namespace btreekv;

static std::string TmpDir() {
  auto p = std::filesystem::temp_directory_path() /
           ("btreekv-mut-" + std::to_string(::getpid()) + "-" + std::to_string(rand()));
  std::filesystem::create_directories(p);
  return p.string();
}

TEST(DeleteAndScan) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    for (int i = 0; i < 500; ++i) {
      char k[16], v[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      std::snprintf(v, sizeof(v), "v%d", i);
      d.Put(k, v);
    }
    for (int i = 0; i < 500; i += 2) {
      char k[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      d.Delete(k);
    }
    std::vector<std::string> got;
    d.Scan("k0100", "k0200", [&](std::string_view k, std::string_view) {
      got.emplace_back(k);
      return true;
    });
    CHECK(!got.empty());
    for (const auto& k : got) {
      int n = std::atoi(k.c_str() + 1);
      CHECK(n % 2 == 1);
    }
    CHECK(d.Stats().keys == 250);
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(DeleteAll) {
  std::string dir = TmpDir();
  {
    DB d = DB::Open(dir);
    for (int i = 0; i < 100; ++i) {
      char k[16];
      std::snprintf(k, sizeof(k), "k%03d", i);
      d.Put(k, "x");
    }
    for (int i = 0; i < 100; ++i) {
      char k[16];
      std::snprintf(k, sizeof(k), "k%03d", i);
      d.Delete(k);
    }
    CHECK(d.Stats().keys == 0);
    CHECK(d.Stats().height == 0);
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

int main() { return check::RunAll(); }
