#include "query/query.h"

namespace findx {
namespace query {

std::vector<uint32_t> DocIDs(const std::vector<postings::Posting>& list) {
  std::vector<uint32_t> out;
  out.reserve(list.size());
  for (const auto& p : list) out.push_back(p.doc_id);
  return out;
}

std::vector<uint32_t> IntersectTwo(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b) {
  std::vector<uint32_t> out;
  size_t i = 0, j = 0;
  while (i < a.size() && j < b.size()) {
    if (a[i] == b[j]) {
      out.push_back(a[i]);
      ++i;
      ++j;
    } else if (a[i] < b[j]) {
      ++i;
    } else {
      ++j;
    }
  }
  return out;
}

std::vector<uint32_t> UnionTwo(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b) {
  std::vector<uint32_t> out;
  size_t i = 0, j = 0;
  while (i < a.size() && j < b.size()) {
    if (a[i] == b[j]) {
      out.push_back(a[i]);
      ++i;
      ++j;
    } else if (a[i] < b[j]) {
      out.push_back(a[i++]);
    } else {
      out.push_back(b[j++]);
    }
  }
  out.insert(out.end(), a.begin() + static_cast<std::ptrdiff_t>(i), a.end());
  out.insert(out.end(), b.begin() + static_cast<std::ptrdiff_t>(j), b.end());
  return out;
}

std::vector<uint32_t> Intersect(const std::vector<std::vector<postings::Posting>>& lists) {
  if (lists.empty()) return {};
  for (const auto& list : lists) {
    if (list.empty()) return {};
  }
  auto cur = DocIDs(lists[0]);
  for (size_t i = 1; i < lists.size(); ++i) {
    cur = IntersectTwo(cur, DocIDs(lists[i]));
    if (cur.empty()) return {};
  }
  return cur;
}

std::vector<uint32_t> Union(const std::vector<std::vector<postings::Posting>>& lists) {
  if (lists.empty()) return {};
  auto cur = DocIDs(lists[0]);
  for (size_t i = 1; i < lists.size(); ++i) {
    cur = UnionTwo(cur, DocIDs(lists[i]));
  }
  return cur;
}

std::vector<uint32_t> Docs(const PostingSource& src, const Query& q) {
  if (q.groups.empty()) return {};
  std::vector<std::vector<postings::Posting>> group_lists;
  for (const auto& terms : q.groups) {
    std::vector<std::vector<postings::Posting>> lists;
    lists.reserve(terms.size());
    for (const auto& term : terms) lists.push_back(src.Postings(term));
    auto ids = Intersect(lists);
    std::vector<postings::Posting> synth;
    synth.reserve(ids.size());
    for (auto id : ids) synth.push_back(postings::Posting{id, 1});
    group_lists.push_back(std::move(synth));
  }
  if (group_lists.size() == 1) return DocIDs(group_lists[0]);
  return Union(group_lists);
}

}  // namespace query
}  // namespace findx
