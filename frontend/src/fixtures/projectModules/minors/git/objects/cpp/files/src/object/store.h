#pragma once
#include "object/hash.h"
#include <string>
#include <utility>
#include <vector>

namespace tinygit {

class Store {
 public:
  explicit Store(std::string dir) : dir_(std::move(dir)) {}
  Hash Put(const std::string& typ, const std::vector<uint8_t>& content);
  std::pair<std::string, std::vector<uint8_t>> Get(const Hash& h) const;
  std::string PathFor(const Hash& h) const;
  const std::string& Dir() const { return dir_; }

 private:
  std::string dir_;
};

}  // namespace tinygit
