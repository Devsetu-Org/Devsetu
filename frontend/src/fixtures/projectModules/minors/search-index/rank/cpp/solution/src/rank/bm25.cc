#include "rank/rank.h"

#include <cmath>

namespace findx {
namespace rank {

double IDF(int n, int df) {
  if (n == 0 || df < 0) return 0;
  return std::log(1.0 + (static_cast<double>(n) - df + 0.5) / (df + 0.5));
}

double Score(int tf, int dl, int df, const Stats& st) {
  if (tf <= 0 || st.n == 0 || st.avg_dl == 0) return 0;
  double idf = IDF(st.n, df);
  double tf_comp = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * dl / st.avg_dl));
  return idf * tf_comp;
}

}  // namespace rank
}  // namespace findx
