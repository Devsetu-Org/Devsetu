#include "check.h"
#include "lex/lex.h"
#include <string>

using namespace tinysh;

TEST(WordsAndQuotes) {
  auto toks = lex::Scan("echo 'hello world' \"hi there\"");
  CHECK_EQ(toks.size(), 4u);
  CHECK_EQ(toks[0].kind, lex::kWord);
  CHECK_EQ(toks[0].lit, std::string("echo"));
  CHECK_EQ(toks[1].lit, std::string("hello world"));
  CHECK_EQ(toks[2].lit, std::string("hi there"));
}

TEST(Escapes) {
  auto toks = lex::Scan("echo hello\\ world \"a\\\"b\" \\>");
  CHECK_EQ(toks[1].lit, std::string("hello world"));
  CHECK_EQ(toks[2].lit, std::string("a\"b"));
  CHECK_EQ(toks[3].kind, lex::kWord);
  CHECK_EQ(toks[3].lit, std::string(">"));
}

TEST(Operators) {
  auto toks = lex::Scan("a | b > out >> log < in 2> err &");
  CHECK_EQ(toks[1].kind, lex::kPipe);
  CHECK_EQ(toks[3].kind, lex::kRedirOut);
  CHECK_EQ(toks[5].kind, lex::kRedirApp);
  CHECK_EQ(toks[7].kind, lex::kRedirIn);
  CHECK_EQ(toks[9].kind, lex::kRedirErr);
  CHECK_EQ(toks[11].kind, lex::kAmp);
}

TEST(Unterminated) {
  bool threw = false;
  try { lex::Scan("echo 'abc"); } catch (...) { threw = true; }
  CHECK(threw);
}

int main() { return check::RunAll(); }
