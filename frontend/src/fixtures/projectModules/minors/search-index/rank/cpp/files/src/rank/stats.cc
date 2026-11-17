#include "rank/rank.h"

#include <stdexcept>

namespace findx {
namespace rank {

std::pair<Stats, std::unordered_map<std::string, int>> CollectStats(
    const DocFreq& src, const std::vector<std::string>& terms) {
  // TODO(5.1)
  (void)src;
  (void)terms;
  throw std::logic_error("TODO(5.1)");
}

}  // namespace rank
}  // namespace findx
