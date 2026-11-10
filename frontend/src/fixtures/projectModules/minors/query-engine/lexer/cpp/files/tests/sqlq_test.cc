#include "check.h"
#include "lex/lex.h"
#include <string>
#include <vector>

TEST(ScanSelect) {
  auto toks = sqlq::lex::Scan("SELECT name FROM users WHERE id = 1;");
  using K = sqlq::lex::Kind;
  std::vector<K> want = {K::kKwSelect, K::kIdent, K::kKwFrom, K::kIdent, K::kKwWhere, K::kIdent, K::kEq, K::kInt, K::kSemicolon, K::kEof};
  CHECK_EQ(toks.size(), want.size());
  for (size_t i = 0; i < want.size(); ++i) CHECK(toks[i].kind == want[i]);
  CHECK_EQ(toks[1].lit, std::string("name"));
  CHECK_EQ(toks[7].lit, std::string("1"));
}

TEST(KeywordCase) {
  auto toks = sqlq::lex::Scan("SeLeCt");
  CHECK(toks[0].kind == sqlq::lex::Kind::kKwSelect);
  CHECK_EQ(toks[0].lit, std::string("SeLeCt"));
}

TEST(StringLit) {
  auto toks = sqlq::lex::Scan("'a''b'");
  CHECK(toks[0].kind == sqlq::lex::Kind::kString);
  CHECK_EQ(toks[0].lit, std::string("a'b"));
}

TEST(Unterminated) {
  bool threw = false;
  try { sqlq::lex::Scan("'abc"); } catch (...) { threw = true; }
  CHECK(threw);
}

TEST(BadChar) {
  bool threw = false;
  try { sqlq::lex::Scan("SELECT @"); } catch (...) { threw = true; }
  CHECK(threw);
}

int main() { return check::RunAll(); }
