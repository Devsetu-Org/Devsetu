#pragma once
#include "object/hash.h"
#include "repo/repo.h"
#include <string>

namespace tinygit {

struct CommitOpts {
  std::string message;
  std::string author;
};

Hash CommitWorktree(const Repo& r, const CommitOpts& opts);

}  // namespace tinygit
