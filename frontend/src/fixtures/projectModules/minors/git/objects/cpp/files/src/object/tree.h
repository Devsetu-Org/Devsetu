#pragma once
#include "object/hash.h"
#include "object/store.h"
#include <string>
#include <vector>

namespace tinygit {

inline constexpr const char* kTypeTree = "tree";
inline constexpr const char* kModeFile = "100644";
inline constexpr const char* kModeTree = "040000";

struct TreeEntry {
  std::string mode;
  std::string name;
  Hash hash;
};

std::vector<uint8_t> EncodeTree(std::vector<TreeEntry> entries);
std::vector<TreeEntry> DecodeTree(const std::vector<uint8_t>& content);
Hash PutTree(Store s, const std::vector<TreeEntry>& entries);
std::vector<TreeEntry> GetTree(Store s, const Hash& h);

}  // namespace tinygit
