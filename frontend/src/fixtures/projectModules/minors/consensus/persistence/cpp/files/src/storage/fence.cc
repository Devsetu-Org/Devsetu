#include "storage/fence.h"
namespace storage {
void Fenced::Fence() {
  std::lock_guard<std::mutex> lk(mu_);
  fenced_ = true;
}
void Fenced::Save(const std::string& state) {
  std::lock_guard<std::mutex> lk(mu_);
  if (fenced_) return;
  inner_->Save(state);
}
std::string Fenced::Load() { return inner_->Load(); }
}  // namespace storage
