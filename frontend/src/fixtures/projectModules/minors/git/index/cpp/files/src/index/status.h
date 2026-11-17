#pragma once
#include "repo/repo.h"
#include <string>
#include <vector>

namespace tinygit {

struct StatusBuckets {
  std::vector<std::string> staged;
  std::vector<std::string> modified;
  std::vector<std::string> untracked;
};

StatusBuckets Status(const Repo& r);

}  // namespace tinygit
