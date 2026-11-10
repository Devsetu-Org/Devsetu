#include "postings/map.h"

#include <algorithm>

namespace findx {
namespace postings {

const std::vector<Posting> Map::kEmpty{};

void Map::Add(const std::string& term, uint32_t doc_id, uint32_t tf) {
  auto& list = terms_[term];
  auto it = std::lower_bound(list.begin(), list.end(), doc_id,
                             [](const Posting& p, uint32_t id) { return p.doc_id < id; });
  if (it != list.end() && it->doc_id == doc_id) {
    it->tf = tf;
    return;
  }
  list.insert(it, Posting{doc_id, tf});
}

std::vector<std::string> Map::Terms() const {
  std::vector<std::string> out;
  out.reserve(terms_.size());
  for (const auto& kv : terms_) out.push_back(kv.first);
  return out;
}

const std::vector<Posting>& Map::Postings(const std::string& term) const {
  auto it = terms_.find(term);
  if (it == terms_.end()) return kEmpty;
  return it->second;
}

void Map::Clear() { terms_.clear(); }

}  // namespace postings
}  // namespace findx
