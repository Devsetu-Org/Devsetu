#pragma once
#include "object/hash.h"
#include "repo/repo.h"
#include <string>

namespace tinygit {

struct HEAD {
  std::string symbolic;  // empty if detached
  Hash hash;
};

HEAD ReadHEAD(const Repo& r);
Hash ResolveHEAD(const Repo& r);
void WriteSymbolicHEAD(const Repo& r, const std::string& name);
void WriteDetachedHEAD(const Repo& r, const Hash& h);

}  // namespace tinygit
