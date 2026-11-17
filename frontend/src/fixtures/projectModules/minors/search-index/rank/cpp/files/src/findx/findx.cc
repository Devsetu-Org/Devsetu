#include "findx/findx.h"

#include "query/query.h"
#include "rank/rank.h"

#include <unordered_map>

namespace findx {
namespace {

struct EnginePostings : query::PostingSource {
  const index::Engine* eng;
  explicit EnginePostings(const index::Engine* e) : eng(e) {}
  std::vector<postings::Posting> Postings(const std::string& term) const override {
    return eng->Postings(term);
  }
};

struct EngineDF : rank::DocFreq {
  const index::Engine* eng;
  explicit EngineDF(const index::Engine* e) : eng(e) {}
  int NumDocs() const override { return eng->NumDocs(); }
  double AvgDL() const override { return eng->AvgDL(); }
  int DF(const std::string& term) const override { return eng->DF(term); }
};

}  // namespace

Index::Index(index::Engine eng) : eng_(std::move(eng)) {}

void Index::Add(const std::string& id, const std::string& text) { eng_.Add(id, text); }

void Index::Flush() { eng_.Flush(); }

std::vector<Hit> Index::Search(const std::string& q, int k) {
  auto parsed = query::Parse(q);
  EnginePostings src(&eng_);
  auto ids = query::Docs(src, parsed);
  if (ids.empty()) return {};

  std::vector<std::string> terms;
  std::unordered_map<std::string, bool> seen;
  for (const auto& g : parsed.groups) {
    for (const auto& t : g) {
      if (seen[t]) continue;
      seen[t] = true;
      terms.push_back(t);
    }
  }
  EngineDF df_src(&eng_);
  auto st_df = rank::CollectStats(df_src, terms);
  const rank::Stats& st = st_df.first;
  const auto& df = st_df.second;

  auto tf_for = [&](const std::string& term, uint32_t doc_id) -> int {
    for (const auto& p : eng_.Postings(term)) {
      if (p.doc_id == doc_id) return static_cast<int>(p.tf);
      if (p.doc_id > doc_id) break;
    }
    return 0;
  };

  std::vector<rank::Hit> raw;
  raw.reserve(ids.size());
  for (auto id : ids) {
    index::Meta meta;
    if (!eng_.Doc(id, &meta)) continue;
    double score = 0;
    for (const auto& term : terms) {
      int tf = tf_for(term, id);
      if (tf == 0) continue;
      score += rank::Score(tf, meta.length, df.at(term), st);
    }
    raw.push_back(rank::Hit{id, score});
  }
  auto top = rank::TopK(raw, k);
  std::vector<Hit> out;
  out.reserve(top.size());
  for (const auto& h : top) out.push_back(Hit{eng_.ExtID(h.doc_id), h.score});
  return out;
}

Index Open(const std::string& dir) { return Index(index::Open(dir)); }

}  // namespace findx
