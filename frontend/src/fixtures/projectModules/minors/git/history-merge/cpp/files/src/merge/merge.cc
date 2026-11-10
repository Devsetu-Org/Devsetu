#include "merge/merge.h"
#include "index/codec.h"
#include "merge/base.h"
#include "object/blob.h"
#include "object/commit.h"
#include "object/tree.h"
#include "ref/head.h"
#include "ref/ref.h"
#include "ref/update.h"
#include "worktree/checkout.h"
#include "worktree/write_tree.h"
#include <fstream>
#include <map>
#include <set>
#include <sstream>
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
  if (tree.IsZero()) return {};
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

void WriteBlobFile(const Repo& r, const std::string& path, const Hash& h) {
  Store s = r.Objects();
  auto data = GetBlob(s, h);
  std::string abs = r.Root() + "/" + path;
  MkDirAll(DirName(abs));
  std::ofstream f(abs, std::ios::binary);
  f.write(reinterpret_cast<const char*>(data.data()), static_cast<std::streamsize>(data.size()));
}

void WriteConflict(const Repo& r, const std::string& path, const Hash& ours, const Hash& theirs) {
  Store s = r.Objects();
  std::vector<uint8_t> ob, tb;
  if (!ours.IsZero()) ob = GetBlob(s, ours);
  if (!theirs.IsZero()) tb = GetBlob(s, theirs);
  std::ostringstream b;
  b << kMarkerOurs << " ours\n";
  b.write(reinterpret_cast<const char*>(ob.data()), static_cast<std::streamsize>(ob.size()));
  if (!ob.empty() && ob.back() != '\n') b << "\n";
  b << kMarkerSep << "\n";
  b.write(reinterpret_cast<const char*>(tb.data()), static_cast<std::streamsize>(tb.size()));
  if (!tb.empty() && tb.back() != '\n') b << "\n";
  b << kMarkerTheirs << " theirs\n";
  std::string body = b.str();
  std::string abs = r.Root() + "/" + path;
  MkDirAll(DirName(abs));
  std::ofstream f(abs, std::ios::binary);
  f.write(body.data(), static_cast<std::streamsize>(body.size()));
}

}  // namespace

MergeResult Merge(const Repo& r, const std::string& their_branch) {
  // TODO(5.4): Merge
  throw std::runtime_error("TODO(5.4): Merge");
}

}  // namespace tinygit
