#include "index/engine.h"

#include <algorithm>

namespace findx {
namespace index {

std::vector<postings::Posting> Engine::Postings(const std::string& term) const {
  std::vector<postings::Posting> out;
  for (const auto& seg : segs) {
    auto got = seg.Postings(term);
    if (got.second) {
      out.insert(out.end(), got.first.begin(), got.first.end());
    }
  }
  const auto& mem_list = mem.Postings(term);
  out.insert(out.end(), mem_list.begin(), mem_list.end());
  std::sort(out.begin(), out.end(),
            [](const postings::Posting& a, const postings::Posting& b) { return a.doc_id < b.doc_id; });
  return out;
}

bool Engine::Doc(uint32_t id, Meta* out) const {
  auto it = docs.find(id);
  if (it == docs.end()) return false;
  *out = it->second;
  return true;
}

int Engine::NumDocs() const { return static_cast<int>(docs.size()); }

double Engine::AvgDL() const {
  if (docs.empty()) return 0;
  long sum = 0;
  for (const auto& kv : docs) sum += kv.second.length;
  return static_cast<double>(sum) / static_cast<double>(docs.size());
}

int Engine::DF(const std::string& term) const { return static_cast<int>(Postings(term).size()); }

std::string Engine::ExtID(uint32_t id) const { return docs.at(id).ext_id; }

}  // namespace index
}  // namespace findx
