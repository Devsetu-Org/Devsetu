#include "kv/client.h"
#include <atomic>
#include <stdexcept>
namespace kv {
static std::atomic<int64_t> next_id{1};
Clerk::Clerk(std::vector<std::shared_ptr<labrpc::ClientEnd>> ends)
  : ends_(std::move(ends)), id_(next_id.fetch_add(1)) {}
void Clerk::Put(const std::string& key, const std::string& value) {
  Do(Op{OpKind::Put, key, value, 0, 0});
}
void Clerk::Delete(const std::string& key) {
  Do(Op{OpKind::Delete, key, "", 0, 0});
}
std::pair<std::string, bool> Clerk::Get(const std::string& key) {
  auto r = Do(Op{OpKind::Get, key, "", 0, 0});
  return {r.value, r.found};
}
Result Clerk::Do(Op op) {
  throw std::runtime_error("TODO(5.4): Clerk::Do");
}
}  // namespace kv
