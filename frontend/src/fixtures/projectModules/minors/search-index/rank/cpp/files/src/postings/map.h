#pragma once

#include "postings/posting.h"

#include <map>
#include <string>
#include <vector>

namespace findx {
namespace postings {

// Map is an in-memory inverted index: term → postings sorted by doc_id.
class Map {
 public:
  // Add records that term appears in doc_id with frequency tf. If the term already
  // has an entry for doc_id, TF is replaced (not summed). Lists stay sorted by doc_id.
  void Add(const std::string& term, uint32_t doc_id, uint32_t tf);

  std::vector<std::string> Terms() const;
  const std::vector<Posting>& Postings(const std::string& term) const;
  void Clear();

 private:
  std::map<std::string, std::vector<Posting>> terms_;
  static const std::vector<Posting> kEmpty;
};

}  // namespace postings
}  // namespace findx
