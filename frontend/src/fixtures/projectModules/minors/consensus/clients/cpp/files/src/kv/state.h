#pragma once
#include "kv/op.h"
#include <string>
#include <unordered_map>
namespace kv {
class State {
 public:
  Result Apply(const Op& op);  // TODO 5.1
 private:
  std::unordered_map<std::string, std::string> data_;
  std::unordered_map<int64_t, int64_t> last_seq_;
};
}  // namespace kv
