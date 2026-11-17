#include "check.h"
#include <cstdio>
#include <stdexcept>
#include "db/db.h"

#include <cstdlib>
#include <string>
#include <unistd.h>
#include <vector>

using namespace lsmkv::db;

static std::string TempDir() {
  std::string buf = "/tmp/lsmkv-scan-XXXXXX";
  buf.push_back('\0');
  if (!mkdtemp(buf.data())) throw std::runtime_error("mkdtemp");
  buf.pop_back();
  return buf;
}

static std::unique_ptr<DB> OpenNever(const std::string& dir) {
  Options o;
  o.sync = lsmkv::wal::SyncMode::kNever;
  o.memtable_size = 1 << 20;
  return Open(dir, o);
}

TEST(ScanRangeAndTombstones) {
  auto dir = TempDir();
  auto d = OpenNever(dir);
  for (int i = 0; i < 10; ++i) {
    char k[8];
    std::snprintf(k, sizeof(k), "k%02d", i);
    d->Put(k, "v");
  }
  d->Delete("k05");
  d->Flush();
  d->Put("k05", "revived");
  std::vector<std::string> keys, values;
  d->Scan("k03", "k08", [&](std::string_view k, std::string_view v) {
    keys.emplace_back(k);
    values.emplace_back(v);
    return true;
  });
  CHECK_EQ(keys.size(), 5u);
  CHECK_EQ(keys[0], "k03");
  CHECK_EQ(keys[1], "k04");
  CHECK_EQ(keys[2], "k05");
  CHECK_EQ(values[2], "revived");
  CHECK_EQ(keys[3], "k06");
  CHECK_EQ(keys[4], "k07");
  d->Close();
}

int main() { return check::RunAll(); }
