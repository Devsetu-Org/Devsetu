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
  Hash ours = ResolveHEAD(r);
  Hash theirs = ReadRef(r, "refs/heads/" + their_branch);
  Store s = r.Objects();
  Hash base = MergeBase(s, ours, theirs);
  if (base == theirs) return MergeResult{ours, {}, false};
  if (base == ours) {
    Checkout(r, theirs);
    HEAD hd = ReadHEAD(r);
    if (!hd.symbolic.empty()) {
      WriteRef(r, hd.symbolic, theirs);
      WriteSymbolicHEAD(r, hd.symbolic);
    }
    return MergeResult{theirs, {}, true};
  }
  Commit oc = GetCommit(s, ours);
  Commit tc = GetCommit(s, theirs);
  Commit bc = GetCommit(s, base);
  auto obase = Flatten(s, bc.tree, "");
  auto oours = Flatten(s, oc.tree, "");
  auto otheirs = Flatten(s, tc.tree, "");
  std::set<std::string> names;
  for (const auto& kv : obase) names.insert(kv.first);
  for (const auto& kv : oours) names.insert(kv.first);
  for (const auto& kv : otheirs) names.insert(kv.first);

  std::vector<std::string> conflicts;
  Index new_idx;
  for (const auto& p : names) {
    auto bit = obase.find(p);
    auto oit = oours.find(p);
    auto tit = otheirs.find(p);
    bool b_ok = bit != obase.end();
    bool o_ok = oit != oours.end();
    bool t_ok = tit != otheirs.end();
    Hash bh = b_ok ? bit->second : kZero;
    Hash oh = o_ok ? oit->second : kZero;
    Hash th = t_ok ? tit->second : kZero;

    if (o_ok && t_ok && oh == th) {
      new_idx.Set(IndexEntry{p, kModeFile, oh});
      WriteBlobFile(r, p, oh);
    } else if (!b_ok && o_ok && !t_ok) {
      new_idx.Set(IndexEntry{p, kModeFile, oh});
      WriteBlobFile(r, p, oh);
    } else if (!b_ok && t_ok && !o_ok) {
      new_idx.Set(IndexEntry{p, kModeFile, th});
      WriteBlobFile(r, p, th);
    } else if (b_ok && o_ok && !t_ok && oh == bh) {
      std::remove((r.Root() + "/" + p).c_str());
    } else if (b_ok && t_ok && !o_ok && th == bh) {
      // keep deleted
    } else if (b_ok && o_ok && !t_ok && oh != bh) {
      conflicts.push_back(p);
      WriteConflict(r, p, oh, kZero);
    } else if (b_ok && t_ok && !o_ok && th != bh) {
      conflicts.push_back(p);
      WriteConflict(r, p, kZero, th);
    } else if (o_ok && t_ok && oh != th) {
      if (b_ok && oh == bh) {
        new_idx.Set(IndexEntry{p, kModeFile, th});
        WriteBlobFile(r, p, th);
      } else if (b_ok && th == bh) {
        new_idx.Set(IndexEntry{p, kModeFile, oh});
        WriteBlobFile(r, p, oh);
      } else {
        conflicts.push_back(p);
        WriteConflict(r, p, oh, th);
      }
    } else if (!o_ok && !t_ok) {
    } else if (o_ok) {
      new_idx.Set(IndexEntry{p, kModeFile, oh});
      WriteBlobFile(r, p, oh);
    }
  }

  if (!conflicts.empty()) {
    SaveIndex(r.IndexPath(), new_idx);
    throw std::runtime_error("merge: conflicts in " + conflicts.front());
  }
  SaveIndex(r.IndexPath(), new_idx);
  Hash tree = WriteTree(r);
  Commit c;
  c.tree = tree;
  c.parents = {ours, theirs};
  c.author = "tinygit <tinygit@devlabs> 0 +0000";
  c.committer = c.author;
  c.message = std::string("Merge branch '") + their_branch + "'\n";
  Hash h = PutCommit(s, c);
  UpdateRef(r, "HEAD", h, kZero);
  return MergeResult{h, {}, false};
}

}  // namespace tinygit
