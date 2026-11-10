#include "storage/mem.h"
namespace storage {
void Mem::Save(const std::string& state) {
  std::lock_guard<std::mutex> lk(mu_);
  state_ = state;
  ++saves_;
}
std::string Mem::Load() {
  std::lock_guard<std::mutex> lk(mu_);
  return state_;
}
int Mem::Saves() const {
  std::lock_guard<std::mutex> lk(mu_);
  return saves_;
}
}  // namespace storage
