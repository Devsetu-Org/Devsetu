#include "object/blob.h"
#include "object/commit.h"
#include "object/hash.h"
#include "object/store.h"
#include "object/tree.h"
#include "ref/head.h"
#include "ref/ref.h"
#include "ref/update.h"
#include "repo/repo.h"
#include "index/add.h"
#include "index/codec.h"
#include "index/status.h"
#include "worktree/checkout.h"
#include "worktree/commit.h"
#include "diff/diff.h"
#include "diff/log.h"
#include "merge/base.h"
#include "merge/merge.h"

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

static Hash CommitFile(const Repo& r, const std::string& path, const std::string& content, const std::string& msg) {
  WriteFile(r.Root() + "/" + path, content);
  Add(r, path);
  return CommitWorktree(r, CommitOpts{msg, ""});
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

TEST(RefsAndHEAD) {
  auto root = TmpDir();
  auto r = Init(root);
  Hash h = HashOf(reinterpret_cast<const uint8_t*>("commit-ish"), 10);
  WriteRef(r, "refs/heads/main", h);
  CHECK(ReadRef(r, "refs/heads/main") == h);
  auto hd = ReadHEAD(r);
  CHECK_EQ(hd.symbolic, std::string("refs/heads/main"));
  CHECK(ResolveHEAD(r) == h);
  Hash h2 = HashOf(reinterpret_cast<const uint8_t*>("other"), 5);
  UpdateRef(r, "HEAD", h2, h);
  CHECK(ReadRef(r, "refs/heads/main") == h2);
  WriteDetachedHEAD(r, h);
  hd = ReadHEAD(r);
  CHECK(hd.symbolic.empty());
  CHECK(hd.hash == h);
}

TEST(CodecAndAddStatus) {
  auto root = TmpDir();
  auto r = Init(root);
  WriteFile(root + "/a.txt", "one\n");
  Add(r, "a.txt");
  Index idx = LoadIndex(r.IndexPath());
  CHECK_EQ(idx.entries.size(), size_t{1});
  CHECK_EQ(idx.entries[0].path, std::string("a.txt"));
  auto data = EncodeIndex(idx);
  auto idx2 = DecodeIndex(data);
  CHECK_EQ(idx2.entries.size(), size_t{1});
  auto st = Status(r);
  CHECK_EQ(st.staged.size(), size_t{1});
  WriteFile(root + "/a.txt", "two\n");
  st = Status(r);
  CHECK_EQ(st.modified.size(), size_t{1});
  WriteFile(root + "/b.txt", "u\n");
  st = Status(r);
  CHECK_EQ(st.untracked.size(), size_t{1});
  CHECK_EQ(st.untracked[0], std::string("b.txt"));
}

TEST(CommitCheckoutRoundTrip) {
  auto root = TmpDir();
  auto r = Init(root);
  WriteFile(root + "/dir/a.txt", "hello\n");
  Add(r, "dir/a.txt");
  Hash h = CommitWorktree(r, CommitOpts{"init", ""});
  WriteFile(root + "/dir/a.txt", "changed\n");
  Checkout(r, h);
  CHECK_EQ(ReadFile(root + "/dir/a.txt"), std::string("hello\n"));
  Commit c = GetCommit(r.Objects(), h);
  auto entries = GetTree(r.Objects(), c.tree);
  CHECK_EQ(entries.size(), size_t{1});
  CHECK_EQ(entries[0].name, std::string("dir"));
}

TEST(LogDiffMerge) {
  auto root = TmpDir();
  auto r = Init(root);
  Hash base = CommitFile(r, "f.txt", "base\n", "base");
  WriteRef(r, "refs/heads/feature", base);
  CheckoutBranch(r, "feature");
  Hash feature = CommitFile(r, "f.txt", "feature\n", "feature");
  CheckoutBranch(r, "main");
  Hash main_h = CommitFile(r, "f.txt", "main\n", "main");
  auto s = r.Objects();
  auto [commits, hashes] = LogWalk(s, main_h);
  CHECK(hashes.size() >= 2);
  Commit oc = GetCommit(s, main_h);
  Commit tc = GetCommit(s, feature);
  auto changes = TreeDiff(s, oc.tree, tc.tree);
  CHECK_EQ(changes.size(), size_t{1});
  CHECK_EQ(changes[0].path, std::string("f.txt"));
  CHECK(MergeBase(s, main_h, feature) == base);
  bool threw = false;
  try { Merge(r, "feature"); } catch (const std::exception& e) {
    threw = std::string(e.what()).find("conflict") != std::string::npos;
  }
  CHECK(threw);
  auto data = ReadFile(root + "/f.txt");
  CHECK(data.find(kMarkerOurs) != std::string::npos);
  CHECK(data.find(kMarkerTheirs) != std::string::npos);
}

TEST(FastForward) {
  auto root = TmpDir();
  auto r = Init(root);
  Hash base = CommitFile(r, "a.txt", "1\n", "base");
  WriteRef(r, "refs/heads/feature", base);
  CheckoutBranch(r, "feature");
  Hash tip = CommitFile(r, "a.txt", "2\n", "feat");
  CheckoutBranch(r, "main");
  auto res = Merge(r, "feature");
  CHECK(res.fast_forward);
  CHECK(res.commit == tip);
  CHECK_EQ(ReadFile(root + "/a.txt"), std::string("2\n"));
}

TEST(CleanMerge) {
  auto root = TmpDir();
  auto r = Init(root);
  Hash base = CommitFile(r, "shared.txt", "s\n", "base");
  WriteRef(r, "refs/heads/feature", base);
  CheckoutBranch(r, "feature");
  CommitFile(r, "feat.txt", "f\n", "feat");
  CheckoutBranch(r, "main");
  CommitFile(r, "main.txt", "m\n", "main");
  auto res = Merge(r, "feature");
  CHECK(!res.fast_forward);
  CHECK(res.conflicts.empty());
  CHECK(!res.commit.IsZero());
  CHECK(access((root + "/shared.txt").c_str(), F_OK) == 0);
  CHECK(access((root + "/feat.txt").c_str(), F_OK) == 0);
  CHECK(access((root + "/main.txt").c_str(), F_OK) == 0);
}

int main() { return check::RunAll(); }
