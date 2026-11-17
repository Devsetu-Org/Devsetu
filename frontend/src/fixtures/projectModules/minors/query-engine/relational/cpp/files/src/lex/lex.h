#pragma once

#include <string>
#include <vector>

#include "lex/token.h"

namespace sqlq {
namespace lex {

class Scanner {
 public:
  explicit Scanner(std::string src) : src_(std::move(src)) {}

  bool Eof() const { return i_ >= static_cast<int>(src_.size()); }
  char Peek() const { return Eof() ? '\0' : src_[i_]; }
  char Bump() { return src_[i_++]; }
  void SkipSpace();
  Token Next();

  std::string src_;
  int i_ = 0;
};

std::vector<Token> Scan(const std::string& src);

bool IsIdentStart(char c);
bool IsIdentPart(char c);
bool IsDigit(char c);

Token ScanIdent(Scanner& s);
Token ScanNumber(Scanner& s);
Token ScanString(Scanner& s);
Token ScanSymbol(Scanner& s);

}  // namespace lex
}  // namespace sqlq
