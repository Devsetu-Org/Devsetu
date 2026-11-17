#include "check.h"
#include "findx/findx.h"

#include <cmath>
#include <cstdlib>
#include <set>
#include <stdexcept>
#include <string>
#include <unistd.h>

using findx::Open;

static std::string TempDir() {
  char tmpl[] = "/tmp/findxXXXXXX";
  if (!mkdtemp(tmpl)) throw std::runtime_error("mkdtemp");
  return tmpl;
}

TEST(SearchANDORRank) {
  auto dir = TempDir();
  auto idx = Open(dir);
  idx.Add("d0", "cat cat cat");
  idx.Add("d1", "cat dog");
  idx.Add("d2", "dog dog dog");
  idx.Add("d3", "bird flies");
  idx.Flush();

  auto hits = idx.Search("cat", 10);
  CHECK_EQ(hits.size(), 2u);
  CHECK_EQ(hits[0].id, std::string("d0"));
  CHECK_EQ(hits[1].id, std::string("d1"));
  CHECK(hits[0].score > hits[1].score);

  hits = idx.Search("cat dog", 10);
  CHECK_EQ(hits.size(), 1u);
  CHECK_EQ(hits[0].id, std::string("d1"));

  hits = idx.Search("cat OR bird", 10);
  std::set<std::string> ids;
  for (const auto& h : hits) {
    ids.insert(h.id);
    CHECK(!std::isnan(h.score));
  }
  CHECK(ids.count("d0"));
  CHECK(ids.count("d1"));
  CHECK(ids.count("d3"));
  CHECK(!ids.count("d2"));

  hits = idx.Search("cat", 1);
  CHECK_EQ(hits.size(), 1u);
  CHECK_EQ(hits[0].id, std::string("d0"));
}

TEST(SearchReopen) {
  auto dir = TempDir();
  auto idx = Open(dir);
  idx.Add("a", "red fox");
  idx.Flush();
  auto idx2 = Open(dir);
  auto hits = idx2.Search("fox", 5);
  CHECK_EQ(hits.size(), 1u);
  CHECK_EQ(hits[0].id, std::string("a"));
}

int main() { return check::RunAll(); }
