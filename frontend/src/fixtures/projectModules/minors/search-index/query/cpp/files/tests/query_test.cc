#include "check.h"
#include "query/query.h"

#include <map>
#include <string>
#include <vector>

using findx::postings::Posting;
using findx::query::Docs;
using findx::query::Intersect;
using findx::query::Parse;
using findx::query::PostingSource;
using findx::query::Union;

static Posting P(uint32_t id, uint32_t tf) { return Posting{id, tf}; }

struct MemSrc : PostingSource {
  std::map<std::string, std::vector<Posting>> data;
  std::vector<Posting> Postings(const std::string& term) const override {
    auto it = data.find(term);
    if (it == data.end()) return {};
    return it->second;
  }
};

TEST(ParseAND) {
  auto q = Parse("The Cat Dog");
  CHECK_EQ(q.groups.size(), 1u);
  CHECK_EQ(q.groups[0].size(), 2u);
  CHECK_EQ(q.groups[0][0], std::string("cat"));
  CHECK_EQ(q.groups[0][1], std::string("dog"));
}

TEST(ParseOR) {
  auto q = Parse("cat OR dog bird");
  CHECK_EQ(q.groups.size(), 2u);
  CHECK_EQ(q.groups[0][0], std::string("cat"));
  CHECK_EQ(q.groups[1][0], std::string("dog"));
  CHECK_EQ(q.groups[1][1], std::string("bird"));
}

TEST(IntersectUnion) {
  std::vector<Posting> a{P(1, 1), P(3, 1), P(5, 1)};
  std::vector<Posting> b{P(3, 2), P(5, 1), P(7, 1)};
  std::vector<Posting> c{P(2, 1), P(5, 1)};
  auto i2 = Intersect({a, b});
  CHECK_EQ(i2.size(), 2u);
  CHECK_EQ(i2[0], 3u);
  CHECK_EQ(i2[1], 5u);
  auto i3 = Intersect({a, b, c});
  CHECK_EQ(i3.size(), 1u);
  CHECK_EQ(i3[0], 5u);
  auto u = Union({a, c});
  CHECK_EQ(u.size(), 4u);
  CHECK_EQ(u[0], 1u);
  CHECK_EQ(u[1], 2u);
  CHECK_EQ(u[2], 3u);
  CHECK_EQ(u[3], 5u);
}

TEST(DocsQuery) {
  MemSrc src;
  src.data["cat"] = {P(1, 1), P(2, 1), P(3, 1)};
  src.data["dog"] = {P(2, 1), P(3, 1)};
  src.data["bird"] = {P(1, 1), P(4, 1)};
  auto and_ids = Docs(src, Parse("cat dog"));
  CHECK_EQ(and_ids.size(), 2u);
  CHECK_EQ(and_ids[0], 2u);
  CHECK_EQ(and_ids[1], 3u);
  auto or_ids = Docs(src, Parse("cat OR bird"));
  CHECK_EQ(or_ids.size(), 4u);
}

int main() { return check::RunAll(); }
