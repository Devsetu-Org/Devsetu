#include "analyze/analyze.h"
#include "check.h"

#include <string>
#include <vector>

using findx::analyze::Analyze;
using findx::analyze::FilterStop;
using findx::analyze::Lower;
using findx::analyze::Tokenize;

static std::string Join(const std::vector<std::string>& v) {
  std::string s;
  for (size_t i = 0; i < v.size(); ++i) {
    if (i) s += ",";
    s += v[i];
  }
  return s;
}

TEST(TokenizeBasic) {
  auto got = Tokenize("Hello, world! Don't 123 go.");
  CHECK_EQ(Join(got), std::string("Hello,world,Don,t,go"));
  CHECK(Tokenize("").empty());
}

TEST(LowerBasic) {
  CHECK_EQ(Join(Lower({"Hello", "WORLD"})), std::string("hello,world"));
}

TEST(FilterStopBasic) {
  CHECK_EQ(Join(FilterStop({"the", "cat", "and", "dog", "a"})), std::string("cat,dog"));
}

TEST(AnalyzeBasic) {
  CHECK_EQ(Join(Analyze("The Cat in the Hat sat on a mat.")), std::string("cat,hat,sat,mat"));
}

int main() { return check::RunAll(); }
