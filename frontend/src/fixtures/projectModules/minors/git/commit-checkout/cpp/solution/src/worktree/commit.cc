#include "worktree/commit.h"
#include "object/commit.h"
#include "ref/head.h"
#include "ref/update.h"
#include "worktree/write_tree.h"
#include <ctime>
#include <stdexcept>

namespace tinygit {

Hash CommitWorktree(const Repo& r, const CommitOpts& opts) {
  if (opts.message.empty()) throw std::runtime_error("worktree: empty commit message");
  Hash tree = WriteTree(r);
  std::vector<Hash> parents;
  try {
    Hash parent = ResolveHEAD(r);
    if (!parent.IsZero()) parents.push_back(parent);
  } catch (...) {
  }
  std::string author = opts.author.empty() ? "tinygit <tinygit@devlabs>" : opts.author;
  std::string stamp = author + " " + std::to_string(static_cast<long long>(std::time(nullptr))) + " +0000";
  Commit c;
  c.tree = tree;
  c.parents = parents;
  c.author = stamp;
  c.committer = stamp;
  c.message = opts.message;
  Store s = r.Objects();
  Hash h = PutCommit(s, c);
  UpdateRef(r, "HEAD", h, kZero);
  return h;
}

}  // namespace tinygit
