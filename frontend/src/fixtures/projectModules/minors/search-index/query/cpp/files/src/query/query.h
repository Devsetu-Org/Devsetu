#pragma once

#include "postings/posting.h"

#include <cstdint>
#include <string>
#include <vector>

namespace findx {
namespace query {

struct Query {
  std::vector<std::vector<std::string>> groups;
};

// Parse analyzes a query string. The literal token OR splits OR-groups.
Query Parse(const std::string& q);

// Intersect returns doc ids that appear in every list.
std::vector<uint32_t> Intersect(const std::vector<std::vector<postings::Posting>>& lists);

// Union returns doc ids that appear in any list.
std::vector<uint32_t> Union(const std::vector<std::vector<postings::Posting>>& lists);

struct PostingSource {
  virtual ~PostingSource() = default;
  virtual std::vector<postings::Posting> Postings(const std::string& term) const = 0;
};

// Docs returns matching internal document ids for q.
std::vector<uint32_t> Docs(const PostingSource& src, const Query& q);

// Helpers given to students.
std::vector<uint32_t> DocIDs(const std::vector<postings::Posting>& list);
std::vector<uint32_t> IntersectTwo(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b);
std::vector<uint32_t> UnionTwo(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b);

}  // namespace query
}  // namespace findx
