#include "rank/rank.h"

#include <cmath>
#include <stdexcept>

namespace findx {
namespace rank {

double IDF(int n, int df) {
  // TODO(5.2): Return 0 when n == 0 or df < 0. Otherwise
  // std::log(1 + (N - df + 0.5) / (df + 0.5)).
  (void)n;
  (void)df;
  (void)std::log;
  throw std::logic_error("TODO(5.2): IDF");
}

double Score(int tf, int dl, int df, const Stats& st) {
  // TODO(5.2): Return 0 when tf <= 0, st.n == 0, or st.avg_dl == 0.
  // score = IDF(st.n, df) * (tf * (K1+1)) / (tf + K1*(1 - B + B*dl/avg_dl)).
  (void)tf;
  (void)dl;
  (void)df;
  (void)st;
  throw std::logic_error("TODO(5.2): Score");
}

}  // namespace rank
}  // namespace findx
