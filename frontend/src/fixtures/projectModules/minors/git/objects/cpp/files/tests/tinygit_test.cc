#include "object/blob.h"
#include "object/commit.h"
#include "object/hash.h"
#include "object/store.h"
#include "object/tree.h"

#include "check.h"
#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <unistd.h>
#include <vector>
#include <cstdlib>

using namespace tinygit;

static std::string TmpDir() {
  char tmpl[] = "/tmp/tinygitXXXXXX";
  if (!mkdtemp(tmpl)) throw std::runtime_error("mkdtemp");
  return tmpl;
}

static void WriteFile(const std::string& path, const std::string& data) {
  auto p = path.rfind('/');
  if (p != std::string::npos) {
    std::string dir = path.substr(0, p);
    std::string cmd = "mkdir -p '" + dir + "'";
    system(cmd.c_str());
  }
  std::ofstream f(path, std::ios::binary);
  f.write(data.data(), data.size());
}

static std::string ReadFile(const std::string& path) {
  std::ifstream f(path, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(f)), {});
}

TEST(HashOfKnown) {
  std::string s = "hello";
  auto h = HashOf(reinterpret_cast<const uint8_t*>(s.data()), s.size());
  CHECK_EQ(h.Hex(), std::string("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d"));
}

TEST(StoreBlobRoundTrip) {
  auto dir = TmpDir();
  Store s(dir + "/objects");
  std::vector<uint8_t> data = {'h','e','l','l','o','\n'};
  Hash h = PutBlob(s, data);
  CHECK_EQ(h.Hex(), std::string("ce013625030ba8dba906f756967f9e9ca394464a"));
  auto got = GetBlob(s, h);
  CHECK(got == data);
  auto pr = s.Get(h);
  CHECK_EQ(pr.first, std::string("blob"));
}

TEST(TreeCommitRoundTrip) {
  auto dir = TmpDir();
  Store s(dir + "/objects");
  Hash bh = PutBlob(s, std::vector<uint8_t>{'x'});
  Hash th = PutTree(s, {TreeEntry{kModeFile, "a.txt", bh}, TreeEntry{kModeFile, "b.txt", bh}});
  auto entries = GetTree(s, th);
  CHECK_EQ(entries.size(), size_t{2});
  CHECK_EQ(entries[0].name, std::string("a.txt"));
  Hash ch = PutCommit(s, Commit{th, {}, "A <a@b> 1 +0000", "", "first\n"});
  Commit c = GetCommit(s, ch);
  CHECK(c.tree == th);
  CHECK_EQ(c.message, std::string("first\n"));
}

int main() { return check::RunAll(); }
