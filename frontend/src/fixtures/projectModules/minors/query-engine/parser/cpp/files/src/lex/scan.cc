#include "lex/lex.h"

namespace sqlq {
namespace lex {

Token ScanIdent(Scanner& s) {
  int start = s.i_;
  while (!s.Eof() && IsIdentPart(s.Peek())) s.Bump();
  std::string lit = s.src_.substr(start, s.i_ - start);
  return Token{Keyword(lit), lit, start};
}

Token ScanNumber(Scanner& s) {
  int start = s.i_;
  while (!s.Eof() && IsDigit(s.Peek())) s.Bump();
  return Token{Kind::kInt, s.src_.substr(start, s.i_ - start), start};
}

Token ScanString(Scanner& s) {
  int start = s.i_;
  s.Bump();
  std::string b;
  while (!s.Eof()) {
    char c = s.Bump();
    if (c == '\n') throw Error(start, "unterminated string");
    if (c == '\'') {
      if (!s.Eof() && s.Peek() == '\'') {
        s.Bump();
        b.push_back('\'');
        continue;
      }
      return Token{Kind::kString, b, start};
    }
    b.push_back(c);
  }
  throw Error(start, "unterminated string");
}

Token ScanSymbol(Scanner& s) {
  int pos = s.i_;
  char c = s.Bump();
  Kind k;
  switch (c) {
    case '*': k = Kind::kStar; break;
    case ',': k = Kind::kComma; break;
    case '(': k = Kind::kLParen; break;
    case ')': k = Kind::kRParen; break;
    case '=': k = Kind::kEq; break;
    case '<': k = Kind::kLt; break;
    case '>': k = Kind::kGt; break;
    case ';': k = Kind::kSemicolon; break;
    case '.': k = Kind::kDot; break;
    default: throw Error(pos, "unexpected character");
  }
  return Token{k, std::string(1, c), pos};
}

}  // namespace lex
}  // namespace sqlq
