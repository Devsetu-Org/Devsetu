#include "check.h"
#include "manifest/manifest.h"

#include <dirent.h>
#include <cstdlib>
#include <fstream>
#include <stdexcept>
#include <string>
#include <unistd.h>
#include <vector>

using namespace lsmkv::manifest;

static std::string TempDir() {
  std::string buf = "/tmp/lsmkv-man-XXXXXX";
  buf.push_back('\0');
  if (!mkdtemp(buf.data())) throw std::runtime_error("mkdtemp");
  buf.pop_back();
  return buf;
}

TEST(MissingManifestIsEmpty) {
  auto dir = TempDir();
  auto s = Load(dir);
  CHECK_EQ(s.next_file, 1u);
  CHECK(s.tables.empty());
}

TEST(SaveThenLoad) {
  auto dir = TempDir();
  State want{12, {11, 10, 7}};
  Save(dir, want);
  auto got = Load(dir);
  CHECK_EQ(got.next_file, want.next_file);
  CHECK_EQ(got.tables.size(), want.tables.size());
  for (size_t i = 0; i < want.tables.size(); ++i) CHECK_EQ(got.tables[i], want.tables[i]);
  std::ifstream in(dir + "/" + kFileName);
  std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  CHECK_EQ(data, std::string("lsmkv-manifest v1\nnext 12\ntable 11\ntable 10\ntable 7\n"));
}

TEST(SaveReplacesAndLeavesNoTempFile) {
  auto dir = TempDir();
  Save(dir, State{3, {2, 1}});
  Save(dir, State{4, {3}});
  auto got = Load(dir);
  CHECK_EQ(got.next_file, 4u);
  CHECK_EQ(got.tables.size(), 1u);
  CHECK_EQ(got.tables[0], 3u);
  // Only MANIFEST should remain (no .tmp).
  DIR* d = opendir(dir.c_str());
  CHECK(d);
  int n = 0;
  while (dirent* e = readdir(d)) {
    std::string name = e->d_name;
    if (name == "." || name == "..") continue;
    ++n;
    CHECK_EQ(name, std::string(kFileName));
  }
  closedir(d);
  CHECK_EQ(n, 1);
}

TEST(StaleTempFileDoesNotMatter) {
  auto dir = TempDir();
  Save(dir, State{2, {1}});
  {
    std::ofstream out(dir + "/" + kFileName + ".tmp");
    out << "lsmkv-manif";
  }
  auto got = Load(dir);
  CHECK_EQ(got.tables.size(), 1u);
  CHECK_EQ(got.tables[0], 1u);
  Save(dir, State{3, {2, 1}});
  got = Load(dir);
  CHECK_EQ(got.next_file, 3u);
  CHECK_EQ(got.tables.size(), 2u);
}

TEST(CorruptManifest) {
  auto dir = TempDir();
  {
    std::ofstream out(dir + "/" + kFileName);
    out << "not a manifest\n";
  }
  bool threw = false;
  try {
    Load(dir);
  } catch (const std::exception&) {
    threw = true;
  }
  CHECK(threw);
}

int main() { return check::RunAll(); }
