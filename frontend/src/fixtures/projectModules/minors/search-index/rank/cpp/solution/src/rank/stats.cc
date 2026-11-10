#include "rank/rank.h"

namespace findx {
namespace rank {

std::pair<Stats, std::unordered_map<std::string, int>> CollectStats(
    const DocFreq& src, const std::vector<std::string>& terms) {
  Stats st{src.NumDocs(), src.AvgDL()};
  std::unordered_map<std::string, int> df;
  for (const auto& t : terms) {
    if (df.count(t)) continue;
    df[t] = src.DF(t);
  }
  return {st, df};
}

}  // namespace rank
}  // namespace findx
