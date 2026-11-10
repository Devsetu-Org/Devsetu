#include "ref/update.h"
#include "ref/head.h"
#include "ref/ref.h"
#include <stdexcept>

namespace tinygit {

void UpdateRef(const Repo& r, const std::string& name, const Hash& new_hash, const Hash& old_hash) {
  std::string target = name;
  if (name == "HEAD") {
    HEAD hd = ReadHEAD(r);
    if (!hd.symbolic.empty()) {
      target = hd.symbolic;
    } else {
      if (!old_hash.IsZero() && hd.hash != old_hash)
        throw std::runtime_error("ref: HEAD mismatch");
      WriteDetachedHEAD(r, new_hash);
      return;
    }
  }
  if (!old_hash.IsZero()) {
    Hash cur = ReadRef(r, target);
    if (cur != old_hash) throw std::runtime_error("ref: CAS mismatch");
  }
  WriteRef(r, target, new_hash);
}

}  // namespace tinygit
