#pragma once
#include "object/hash.h"
#include "object/store.h"

namespace tinygit {

Hash MergeBase(Store s, const Hash& a, const Hash& b);

}  // namespace tinygit
