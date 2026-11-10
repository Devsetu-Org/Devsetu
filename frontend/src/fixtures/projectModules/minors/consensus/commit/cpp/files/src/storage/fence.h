#pragma once
#include "storage/store.h"
#include <memory>
#include <mutex>

namespace storage {

class Fenced : public Store {
 public:
  explicit Fenced(std::shared_ptr<Store> inner) : inner_(std::move(inner)) {}
  void Fence();
  void Save(const std::string& state) override;
  std::string Load() override;
 private:
  std::mutex mu_;
  std::shared_ptr<Store> inner_;
  bool fenced_ = false;
};

}  // namespace storage
