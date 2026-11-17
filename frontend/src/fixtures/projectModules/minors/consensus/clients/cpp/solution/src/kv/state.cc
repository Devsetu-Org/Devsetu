#include "kv/state.h"
namespace kv {
Result State::Apply(const Op& op) {
  bool fresh = op.seq > last_seq_[op.client_id];
  if (fresh) last_seq_[op.client_id] = op.seq;
  if (op.kind == OpKind::Get) {
    auto it = data_.find(op.key);
    if (it == data_.end()) return {};
    return Result{it->second, true};
  }
  if (op.kind == OpKind::Put) {
    if (fresh) data_[op.key] = op.value;
  } else if (op.kind == OpKind::Delete) {
    if (fresh) data_.erase(op.key);
  }
  return {};
}
}  // namespace kv
