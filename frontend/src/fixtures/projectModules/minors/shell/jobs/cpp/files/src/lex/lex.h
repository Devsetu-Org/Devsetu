#pragma once
#include <string>
#include <vector>
#include "lex/token.h"

namespace tinysh::lex {

struct Scanner {
  std::string src;
  int i = 0;

  bool Eof() const { return i >= static_cast<int>(src.size()); }
  char Peek() const { return Eof() ? '\0' : src[i]; }
  char PeekAt(int off) const {
    int j = i + off;
    return j >= static_cast<int>(src.size()) ? '\0' : src[j];
  }
  char Bump() { return src[i++]; }
  void SkipSpace();
  bool AtOp() const;
  Token Next();
};

bool OpStart(char c, char next);
std::vector<Token> Scan(const std::string& src);

}  // namespace tinysh::lex
