#pragma once
#include "object/hash.h"
#include "repo/repo.h"

namespace tinygit {

Hash WriteTree(const Repo& r);

}  // namespace tinygit
