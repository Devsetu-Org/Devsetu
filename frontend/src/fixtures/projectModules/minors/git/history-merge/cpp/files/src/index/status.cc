#include "index/status.h"
#include "index/codec.h"
#include "object/commit.h"
#include "object/header.h"
#include "object/tree.h"
#include "object/blob.h"
#include "ref/head.h"
#include <algorithm>
#include <map>
#include <vector>
#include <dirent.h>
#include <fstream>
#include <sys/stat.h>

namespace tinygit {
namespace {

std::map<std::string, Hash> FlattenTree(Store s, const Hash& tree, const std::string& prefix);

std::map<std::string, Hash> FlattenTree(Store s, const Hash& tree, const std::string& prefix) {
  std::map<std::string, Hash> out;
  for (const auto& e : GetTree(s, tree)) {
    std::string path = prefix.empty() ? e.name : prefix + "/" + e.name;
    if (e.mode == kModeTree) {
      auto sub = FlattenTree(s, e.hash, path);
      out.insert(sub.begin(), sub.end());
    } else if (e.mode == kModeFile) {
      out[path] = e.hash;
    }
  }
  return out;
}

std::map<std::string, Hash> HeadFileMap(const Repo& r) {
  std::map<std::string, Hash> out;
  Hash h;
  try {
    h = ResolveHEAD(r);
  } catch (...) {
    return out;
  }
  if (h.IsZero()) return out;
  try {
    Commit c = GetCommit(r.Objects(), h);
    Store s = r.Objects();
    return FlattenTree(s, c.tree, "");
  } catch (...) {
    return out;
  }
}

void WalkUntracked(const std::string& root, const std::string& cur,
                   const std::map<std::string, IndexEntry*>& in_index,
                   std::vector<std::string>& out) {
  DIR* d = opendir(cur.c_str());
  if (!d) return;
  while (auto* ent = readdir(d)) {
    std::string name = ent->d_name;
    if (name == "." || name == "..") continue;
    if (name == ".tinygit" || name == ".git") continue;
    std::string abs = cur + "/" + name;
    std::string rel = abs.substr(root.size() + 1);
    struct stat st;
    if (::stat(abs.c_str(), &st) != 0) continue;
    if (S_ISDIR(st.st_mode)) {
      WalkUntracked(root, abs, in_index, out);
    } else {
      if (!in_index.count(rel)) out.push_back(rel);
    }
  }
  closedir(d);
}

std::vector<std::string> UniqueSorted(std::vector<std::string> v) {
  std::sort(v.begin(), v.end());
  v.erase(std::unique(v.begin(), v.end()), v.end());
  return v;
}

}  // namespace

StatusBuckets Status(const Repo& r) {
  Index idx = LoadIndex(r.IndexPath());
  auto head_files = HeadFileMap(r);
  StatusBuckets st;
  std::map<std::string, IndexEntry*> in_index;
  for (auto& e : idx.entries) in_index[e.path] = &e;

  for (const auto& e : idx.entries) {
    auto it = head_files.find(e.path);
    if (it == head_files.end() || it->second != e.hash) st.staged.push_back(e.path);
    std::string abs = r.Root() + "/" + e.path;
    std::ifstream f(abs, std::ios::binary);
    if (!f) {
      st.modified.push_back(e.path);
      continue;
    }
    std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)), {});
    auto raw = EncodeHeader(kTypeBlob, data);
    if (HashOf(raw) != e.hash) st.modified.push_back(e.path);
  }
  for (const auto& kv : head_files) {
    if (!in_index.count(kv.first)) st.staged.push_back(kv.first);
  }
  WalkUntracked(r.Root(), r.Root(), in_index, st.untracked);
  st.staged = UniqueSorted(st.staged);
  st.modified = UniqueSorted(st.modified);
  st.untracked = UniqueSorted(st.untracked);
  return st;
}

}  // namespace tinygit
