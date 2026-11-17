#include "lex/lex.h"

namespace sqlq {
namespace lex {

bool IsIdentStart(char c) {
  return c == '_' || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}
bool IsIdentPart(char c) { return IsIdentStart(c) || IsDigit(c); }
bool IsDigit(char c) { return c >= '0' && c <= '9'; }

void Scanner::SkipSpace() {
  while (!Eof()) {
    char c = Peek();
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') ++i_;
    else return;
  }
}

Token Scanner::Next() {
  char c = Peek();
  if (IsIdentStart(c)) return ScanIdent(*this);
  if (IsDigit(c)) return ScanNumber(*this);
  if (c == '\'') return ScanString(*this);
  return ScanSymbol(*this);
}

std::vector<Token> Scan(const std::string& src) {
  Scanner s(src);
  std::vector<Token> out;
  for (;;) {
    s.SkipSpace();
    if (s.Eof()) {
      out.push_back(Token{Kind::kEof, "", s.i_});
      return out;
    }
    out.push_back(s.Next());
  }
}

}  // namespace lex
}  // namespace sqlq
