#include "db/apply.h"

#include "db/db.h"

#include <cstring>
#include <vector>

namespace btreekv {

void ApplyRecords(DB* d, const std::vector<Record>& recs) {
  for (const auto& r : recs) {
    if (r.kind == WalKind::kPage) {
      std::vector<uint8_t> buf(kPageSize, 0);
      std::memcpy(buf.data(), r.data.data(), std::min(r.data.size(), size_t(kUsable)));
      d->store()->WritePage(r.page, buf.data(), buf.size());
    } else if (r.kind == WalKind::kMeta) {
      uint32_t root = 0, count = 0, free = 0;
      UnpackMeta(r, &root, &count, &free);
      d->store()->SetMeta(Meta{root, count, free});
    }
  }
}

}  // namespace btreekv
