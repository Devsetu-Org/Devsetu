#include "postings/map.h"

#include <algorithm>
#include <stdexcept>

namespace findx {
namespace postings {

const std::vector<Posting> Map::kEmpty{};

void Map::Add(const std::string& term, uint32_t doc_id, uint32_t tf) {
  // TODO(2.1)
  (void)term;
  (void)doc_id;
  (void)tf;
  (void)terms_;
  throw std::logic_error("TODO(2.1)");
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
