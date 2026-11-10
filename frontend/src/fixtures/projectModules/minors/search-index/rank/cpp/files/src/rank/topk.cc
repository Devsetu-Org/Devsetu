#include "rank/rank.h"

#include <algorithm>
#include <stdexcept>

namespace findx {
namespace rank {

std::vector<Hit> TopK(const std::vector<Hit>& hits, int k) {
  // TODO(5.3): Copy hits. Sort by score descending, then doc_id ascending.
  // If k > 0 and len > k, truncate to k.
  (void)hits;
  (void)k;
  (void)std::stable_sort;
  throw std::logic_error("TODO(5.3): TopK");
}

}  // namespace rank
}  // namespace findx
