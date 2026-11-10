#include "check.h"
#include "postings/map.h"
#include "postings/segment.h"

using findx::postings::DecodeSegment;
using findx::postings::Map;
using findx::postings::Posting;
using findx::postings::WriteSegment;

TEST(MapAddSorted) {
  Map m;
  m.Add("cat", 3, 1);
  m.Add("cat", 1, 2);
  m.Add("cat", 2, 1);
  m.Add("cat", 1, 5);
  const auto& got = m.Postings("cat");
  CHECK_EQ(got.size(), 3u);
  CHECK(got[0] == (Posting{1, 5}));
  CHECK(got[1] == (Posting{2, 1}));
  CHECK(got[2] == (Posting{3, 1}));
}

TEST(SegmentRoundTrip) {
  Map m;
  m.Add("cat", 1, 2);
  m.Add("cat", 3, 1);
  m.Add("dog", 2, 4);
  m.Add("apple", 1, 1);
  std::vector<uint8_t> buf;
  WriteSegment(&buf, m);
  auto seg = DecodeSegment(buf);
  auto cat = seg.Postings("cat");
  CHECK(cat.second);
  CHECK_EQ(cat.first.size(), 2u);
  CHECK(cat.first[0] == (Posting{1, 2}));
  CHECK(cat.first[1] == (Posting{3, 1}));
  auto dog = seg.Postings("dog");
  CHECK(dog.second);
  CHECK(dog.first[0] == (Posting{2, 4}));
  CHECK(!seg.Postings("missing").second);
  auto terms = seg.Terms();
  CHECK_EQ(terms.size(), 3u);
  CHECK_EQ(terms[0], std::string("apple"));
  CHECK_EQ(terms[1], std::string("cat"));
  CHECK_EQ(terms[2], std::string("dog"));
}

int main() { return check::RunAll(); }
