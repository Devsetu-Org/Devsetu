#include "check.h"
#include "rank/rank.h"

#include <cmath>
#include <map>
#include <string>

using findx::rank::CollectStats;
using findx::rank::DocFreq;
using findx::rank::Hit;
using findx::rank::IDF;
using findx::rank::Score;
using findx::rank::Stats;
using findx::rank::TopK;

struct StubDF : DocFreq {
  int n;
  double avg;
  std::map<std::string, int> df;
  StubDF(int n_, double avg_, std::map<std::string, int> df_) : n(n_), avg(avg_), df(std::move(df_)) {}
  int NumDocs() const override { return n; }
  double AvgDL() const override { return avg; }
  int DF(const std::string& term) const override { return df.at(term); }
};

TEST(IDFBasic) {
  double got = IDF(100, 10);
  double want = std::log(1 + (100 - 10 + 0.5) / (10 + 0.5));
  CHECK(std::fabs(got - want) < 1e-12);
}

TEST(ScoreMonotonicTF) {
  Stats st{100, 50};
  CHECK(Score(5, 50, 10, st) > Score(1, 50, 10, st));
}

TEST(TopKTieBreak) {
  std::vector<Hit> hits{{3, 1.0}, {1, 2.0}, {2, 2.0}, {4, 0.5}};
  auto got = TopK(hits, 3);
  CHECK_EQ(got.size(), 3u);
  CHECK_EQ(got[0].doc_id, 1u);
  CHECK_EQ(got[1].doc_id, 2u);
  CHECK_EQ(got[2].doc_id, 3u);
}

TEST(CollectStatsBasic) {
  StubDF src{10, 4, {{"cat", 3}, {"dog", 1}}};
  auto got = CollectStats(src, {"cat", "dog", "cat"});
  CHECK_EQ(got.first.n, 10);
  CHECK(got.first.avg_dl == 4);
  CHECK_EQ(got.second.at("cat"), 3);
  CHECK_EQ(got.second.at("dog"), 1);
}

int main() { return check::RunAll(); }
