#pragma once
#include "object/hash.h"
#include "object/store.h"
#include <string>
#include <vector>

namespace tinygit {

struct Change {
  std::string path;
  Hash old_hash;
  Hash new_hash;
  std::string status;  // A M D
};

std::vector<Change> TreeDiff(Store s, const Hash& a, const Hash& b);

}  // namespace tinygit
