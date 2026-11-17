#pragma once
#include <string>
#include <memory>

namespace storage {

class Store {
 public:
  virtual ~Store() = default;
  virtual void Save(const std::string& state) = 0;
  virtual std::string Load() = 0;  // empty string means none
};

}  // namespace storage
