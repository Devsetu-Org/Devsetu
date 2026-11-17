#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace findx {
namespace rank {

constexpr double K1 = 1.2;
constexpr double B = 0.75;

struct Stats {
  int n = 0;
  double avg_dl = 0;
};

struct Hit {
  uint32_t doc_id = 0;
  double score = 0;
};

struct DocFreq {
  virtual ~DocFreq() = default;
  virtual int NumDocs() const = 0;
  virtual double AvgDL() const = 0;
  virtual int DF(const std::string& term) const = 0;
};

// CollectStats builds collection Stats and a per-term DF map for terms.
std::pair<Stats, std::unordered_map<std::string, int>> CollectStats(
    const DocFreq& src, const std::vector<std::string>& terms);

double IDF(int n, int df);
double Score(int tf, int dl, int df, const Stats& st);
std::vector<Hit> TopK(const std::vector<Hit>& hits, int k);

}  // namespace rank
}  // namespace findx
