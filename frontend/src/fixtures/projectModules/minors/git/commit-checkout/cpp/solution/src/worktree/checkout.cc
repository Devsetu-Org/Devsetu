#include "worktree/checkout.h"
#include "index/codec.h"
#include "object/blob.h"
#include "object/commit.h"
#include "object/header.h"
#include "object/tree.h"
#include "ref/head.h"
#include "ref/ref.h"
#include <fstream>
#include <vector>
#include <map>
#include <stdexcept>
#include <sys/stat.h>

namespace tinygit {
namespace {

void MkDirAll(const std::string& path) {
  size_t pos = 0;
  while (true) {
    pos = path.find('/', pos + 1);
    std::string sub = (pos == std::string::npos) ? path : path.substr(0, pos);
    if (!sub.empty()) ::mkdir(sub.c_str(), 0755);
    if (pos == std::string::npos) break;
  }
}
std::string DirName(const std::string& path) {
  auto p = path.rfind('/');
  return p == std::string::npos ? "." : path.substr(0, p);
}

std::map<std::string, Hash> Flatten(Store s, const Hash& tree, const std::string& prefix) {
  std::map<std::string, Hash> out;
  for (const auto& e : GetTree(s, tree)) {
    std::string path = prefix.empty() ? e.name : prefix + "/" + e.name;
    if (e.mode == kModeTree) {
      auto sub = Flatten(s, e.hash, path);
      out.insert(sub.begin(), sub.end());
    } else if (e.mode == kModeFile) {
      out[path] = e.hash;
    }
  }
  return out;
}

void SafetyCheck(const Repo& r, const Index& idx, const std::map<std::string, Hash>& target) {
  for (const auto& e : idx.entries) {
    std::string abs = r.Root() + "/" + e.path;
    std::ifstream f(abs, std::ios::binary);
    if (!f) continue;
    std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)), {});
    auto raw = EncodeHeader(kTypeBlob, data);
    Hash work = HashOf(raw);
    if (work == e.hash) continue;
    auto it = target.find(e.path);
    if (it != target.end() && it->second == work) continue;
    if (it == target.end() || it->second != e.hash)
      throw std::runtime_error("worktree: local changes would be overwritten: " + e.path);
  }
}

}  // namespace

void Checkout(const Repo& r, const Hash& commit) {
  Store s = r.Objects();
  Commit c = GetCommit(s, commit);
  auto files = Flatten(s, c.tree, "");
  Index idx = LoadIndex(r.IndexPath());
  SafetyCheck(r, idx, files);
  for (const auto& e : idx.entries) {
    if (!files.count(e.path)) {
      std::string abs = r.Root() + "/" + e.path;
      std::remove(abs.c_str());
    }
  }
  Index new_idx;
  for (const auto& kv : files) {
    auto data = GetBlob(s, kv.second);
    std::string abs = r.Root() + "/" + kv.first;
    MkDirAll(DirName(abs));
    std::ofstream f(abs, std::ios::binary);
    f.write(reinterpret_cast<const char*>(data.data()), static_cast<std::streamsize>(data.size()));
    new_idx.Set(IndexEntry{kv.first, kModeFile, kv.second});
  }
  SaveIndex(r.IndexPath(), new_idx);
  WriteDetachedHEAD(r, commit);
}

void CheckoutBranch(const Repo& r, const std::string& branch) {
  std::string name = "refs/heads/" + branch;
  Hash h = ReadRef(r, name);
  Checkout(r, h);
  WriteSymbolicHEAD(r, name);
}

}  // namespace tinygit
