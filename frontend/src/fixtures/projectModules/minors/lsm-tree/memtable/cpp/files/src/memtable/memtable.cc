#include "memtable/memtable.h"

#include <mutex>
#include <stdexcept>

namespace lsmkv {

const char* ResultName(Result result) {
  switch (result) {
    case Result::kMissing:
      return "missing";
    case Result::kFound:
      return "found";
    case Result::kDeleted:
      return "deleted";
  }
  return "unknown";
}

Memtable::Memtable() : list_(0x5EED) {}

void Memtable::Put(std::string_view key, std::string_view value) {
  std::unique_lock lock(mu_);
  list_.Put(std::string(key), std::string(value), Kind::kValue);
}

void Memtable::Delete(std::string_view key) {
  // ── TODO(1.3) — a delete is a write ───────────────────────────────────────
  (void)key;
  throw std::logic_error("TODO(1.3)");
}

Result Memtable::Get(std::string_view key, std::string* value) const {
  // ── TODO(1.3) — three answers, not two ────────────────────────────────────
  (void)key;
  (void)value;
  throw std::logic_error("TODO(1.3)");
}

size_t Memtable::Len() const {
  std::shared_lock lock(mu_);
  return list_.length();
}

size_t Memtable::ApproximateSize() const {
  std::shared_lock lock(mu_);
  return list_.size();
}

}  // namespace lsmkv
