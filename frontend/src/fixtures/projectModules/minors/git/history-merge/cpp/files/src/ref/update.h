#pragma once
#include "object/hash.h"
#include "repo/repo.h"
#include <string>

namespace tinygit {

void UpdateRef(const Repo& r, const std::string& name, const Hash& new_hash, const Hash& old_hash);

}  // namespace tinygit
