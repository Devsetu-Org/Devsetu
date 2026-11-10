#pragma once
#include "object/hash.h"
#include "repo/repo.h"
#include <string>

namespace tinygit {

void Checkout(const Repo& r, const Hash& commit);
void CheckoutBranch(const Repo& r, const std::string& branch);

}  // namespace tinygit
