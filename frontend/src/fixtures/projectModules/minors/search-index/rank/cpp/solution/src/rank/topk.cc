#include "rank/rank.h"

#include <algorithm>

namespace findx {
namespace rank {

std::vector<Hit> TopK(const std::vector<Hit>& hits, int k) {
  std::vector<Hit> out = hits;
  std::stable_sort(out.begin(), out.end(), [](const Hit& a, const Hit& b) {
    if (a.score != b.score) return a.score > b.score;
    return a.doc_id < b.doc_id;
  });
  if (k > 0 && static_cast<int>(out.size()) > k) out.resize(static_cast<size_t>(k));
  return out;
}

}  // namespace rank
}  // namespace findx
