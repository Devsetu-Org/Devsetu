#pragma once
#include "object/hash.h"
#include "repo/repo.h"
#include <string>

namespace tinygit {

Hash ReadRef(const Repo& r, const std::string& name);
void WriteRef(const Repo& r, const std::string& name, const Hash& h);
std::string SafePath(const Repo& r, const std::string& name);

}  // namespace tinygit
