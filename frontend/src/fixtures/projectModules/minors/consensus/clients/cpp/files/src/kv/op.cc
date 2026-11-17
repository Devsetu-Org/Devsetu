#include "kv/op.h"
#include <sstream>
namespace kv {
std::string EncodeOp(const Op& op) {
  std::ostringstream o;
  o << (int)op.kind << '|' << op.key.size() << '|' << op.key << '|'
    << op.value.size() << '|' << op.value << '|' << op.client_id << '|' << op.seq << '|';
  return o.str();
}
Op DecodeOp(const std::string& data) {
  std::istringstream in(data); Op op; char b; int k; size_t n;
  in >> k >> b; op.kind = (OpKind)k;
  in >> n >> b; op.key.resize(n); in.read(&op.key[0], n); in >> b;
  in >> n >> b; op.value.resize(n); in.read(&op.value[0], n); in >> b;
  in >> op.client_id >> b >> op.seq >> b;
  return op;
}
}  // namespace kv
