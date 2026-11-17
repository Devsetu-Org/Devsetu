#pragma once
#include "storage/store.h"
#include <mutex>
#include <string>

namespace storage {

class Mem : public Store {
 public:
  void Save(const std::string& state) override;
  std::string Load() override;
  int Saves() const;
 private:
  mutable std::mutex mu_;
  std::string state_;
  int saves_ = 0;
};

}  // namespace storage
