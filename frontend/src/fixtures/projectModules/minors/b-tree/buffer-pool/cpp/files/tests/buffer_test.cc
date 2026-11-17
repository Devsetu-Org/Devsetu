#include "buffer/pool.h"
#include "db/db.h"
#include "pager/pager.h"
#include "check.h"

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <unistd.h>

using namespace btreekv;

static std::string TmpDir() {
  auto p = std::filesystem::temp_directory_path() /
           ("btreekv-buf-" + std::to_string(::getpid()) + "-" + std::to_string(rand()));
  std::filesystem::create_directories(p);
  return p.string();
}

TEST(SmallPoolPutGet) {
  std::string dir = TmpDir();
  Options opts;
  opts.pool_frames = 4;
  {
    DB d = DB::Open(dir, opts);
    for (int i = 0; i < 200; ++i) {
      char k[16], v[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      std::snprintf(v, sizeof(v), "v%d", i);
      d.Put(k, v);
    }
    for (int i = 0; i < 200; i += 7) {
      char k[16], want[16];
      std::snprintf(k, sizeof(k), "k%04d", i);
      std::snprintf(want, sizeof(want), "v%d", i);
      std::string got;
      CHECK(d.Get(k, &got) && got == want);
    }
    auto s = d.Stats();
    CHECK(s.keys == 200);
    CHECK(s.resident <= 4);
    d.Close();
  }
  std::filesystem::remove_all(dir);
}

TEST(PinUnpinRoundtrip) {
  std::string dir = TmpDir();
  Pager pg = Pager::Open(dir + "/data.db");
  PagerBacking backing(&pg);
  Pool pool(&backing, 2);
  PageNo no = pg.Allocate();
  std::vector<uint8_t> buf(kPageSize, 0);
  buf[0] = 7;
  pool.WritePage(no, buf.data(), buf.size());
  std::vector<uint8_t> got(kPageSize, 0);
  pool.ReadPage(no, got.data(), got.size());
  CHECK(got[0] == 7);
  pool.FlushAll();
  pg.Close();
  std::filesystem::remove_all(dir);
}

int main() { return check::RunAll(); }
