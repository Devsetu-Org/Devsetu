#pragma once
#include "object/hash.h"
#include "object/store.h"
#include <string>
#include <vector>

namespace tinygit {

inline constexpr const char* kTypeCommit = "commit";

struct Commit {
  Hash tree;
  std::vector<Hash> parents;
  std::string author;
  std::string committer;
  std::string message;
};

std::vector<uint8_t> EncodeCommit(const Commit& c);
Commit DecodeCommit(const std::vector<uint8_t>& content);
Hash PutCommit(Store s, const Commit& c);
Commit GetCommit(Store s, const Hash& h);

}  // namespace tinygit
