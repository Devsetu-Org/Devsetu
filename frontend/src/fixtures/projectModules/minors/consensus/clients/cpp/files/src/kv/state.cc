#include "kv/state.h"
#include <stdexcept>
namespace kv {
Result State::Apply(const Op& op) {
  throw std::runtime_error("TODO(5.1): State::Apply");
}
}  // namespace kv
