#pragma once
#include "object/hash.h"
#include "object/store.h"
#include <vector>

namespace tinygit {

inline constexpr const char* kTypeBlob = "blob";

Hash PutBlob(Store s, const std::vector<uint8_t>& data);
std::vector<uint8_t> GetBlob(Store s, const Hash& h);

}  // namespace tinygit
