#pragma once
#include "object/hash.h"
#include <string>
#include <vector>

namespace tinygit {

struct IndexEntry {
  std::string path;
  std::string mode;
  Hash hash;
};

struct Index {
  std::vector<IndexEntry> entries;
  IndexEntry* Get(const std::string& path);
  const IndexEntry* Get(const std::string& path) const;
  void Set(const IndexEntry& e);
  void Remove(const std::string& path);
};

std::vector<uint8_t> EncodeIndex(Index idx);
Index DecodeIndex(const std::vector<uint8_t>& data);
Index LoadIndex(const std::string& path);
void SaveIndex(const std::string& path, const Index& idx);

}  // namespace tinygit
