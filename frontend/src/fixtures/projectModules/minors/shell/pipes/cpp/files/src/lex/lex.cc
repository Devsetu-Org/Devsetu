#include "lex/lex.h"
#include "lex/scan.h"

namespace tinysh::lex {

void Scanner::SkipSpace() {
  while (!Eof()) {
    char c = Peek();
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') i++;
    else return;
  }
}

bool Scanner::AtOp() const {
  char c = Peek();
  if (c == '|' || c == '>' || c == '<' || c == '&') return true;
  if (c == '2') return PeekAt(1) == '>';
  return false;
}

Token Scanner::Next() {
  if (AtOp()) return ScanOp(*this);
  return ScanWord(*this);
}

bool OpStart(char c, char next) {
  if (c == '|' || c == '>' || c == '<' || c == '&') return true;
  if (c == '2') return next == '>';
  return false;
}

std::vector<Token> Scan(const std::string& src) {
  Scanner s{src, 0};
  std::vector<Token> out;
  for (;;) {
    s.SkipSpace();
    if (s.Eof()) {
      out.push_back(Token{kEOF, "", s.i});
      return out;
    }
    out.push_back(s.Next());
  }
}

}  // namespace tinysh::lex
