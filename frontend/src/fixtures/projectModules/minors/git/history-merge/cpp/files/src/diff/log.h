#pragma once
#include "object/commit.h"
#include "object/store.h"
#include <utility>
#include <vector>

namespace tinygit {

std::pair<std::vector<Commit>, std::vector<Hash>> LogWalk(Store s, const Hash& tip);

}  // namespace tinygit
