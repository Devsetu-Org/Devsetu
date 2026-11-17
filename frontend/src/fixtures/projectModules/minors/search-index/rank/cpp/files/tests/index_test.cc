#include "check.h"
#include "index/engine.h"
#include "postings/posting.h"

#include <cstdlib>
#include <stdexcept>
#include <string>
#include <unistd.h>

using findx::index::Open;
using findx::postings::Posting;

static std::string TempDir() {
  char tmpl[] = "/tmp/findxXXXXXX";
  if (!mkdtemp(tmpl)) throw std::runtime_error("mkdtemp");
  return tmpl;
}

TEST(AddFlushOpen) {
  auto dir = TempDir();
  auto e = Open(dir);
  e.Add("a", "The cat sat");
  e.Add("b", "A cat and a dog");
  e.Flush();
  e.Add("c", "birds fly");
  e.Flush();

  auto e2 = Open(dir);
  CHECK_EQ(e2.NumDocs(), 3);
  auto cat = e2.Postings("cat");
  CHECK_EQ(cat.size(), 2u);
  CHECK(cat[0] == (Posting{0, 1}));
  CHECK(cat[1] == (Posting{1, 1}));
  CHECK_EQ(e2.ExtID(2), std::string("c"));
  CHECK_EQ(e2.Postings("fly").size(), 1u);
}

TEST(DuplicateID) {
  auto dir = TempDir();
  auto e = Open(dir);
  e.Add("x", "hi");
  bool threw = false;
  try {
    e.Add("x", "yo");
  } catch (...) {
    threw = true;
  }
  CHECK(threw);
}

int main() { return check::RunAll(); }
