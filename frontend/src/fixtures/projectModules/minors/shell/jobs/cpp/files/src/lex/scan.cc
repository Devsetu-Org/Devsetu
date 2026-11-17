#include "lex/scan.h"

namespace tinysh::lex {

Token ScanWord(Scanner& s) {
  int start = s.i;
  std::string b;
  while (!s.Eof()) {
    char c = s.Peek();
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') break;
    if (OpStart(c, s.PeekAt(1))) break;
    if (c == '\\') {
      s.Bump();
      if (s.Eof()) throw Error(start, "trailing backslash");
      b.push_back(s.Bump());
    } else if (c == '\'') {
      s.Bump();
      for (;;) {
        if (s.Eof()) throw Error(start, "unterminated single quote");
        char q = s.Bump();
        if (q == '\'') break;
        b.push_back(q);
      }
    } else if (c == '"') {
      s.Bump();
      for (;;) {
        if (s.Eof()) throw Error(start, "unterminated double quote");
        char q = s.Bump();
        if (q == '"') break;
        if (q == '\\') {
          if (s.Eof()) throw Error(start, "trailing backslash");
          b.push_back(s.Bump());
          continue;
        }
        b.push_back(q);
      }
    } else {
      b.push_back(s.Bump());
    }
  }
  if (b.empty() && s.i == start) throw Error(start, "empty word");
  return Token{kWord, b, start};
}

Token ScanOp(Scanner& s) {
  int pos = s.i;
  char c = s.Bump();
  switch (c) {
    case '|': return Token{kPipe, "|", pos};
    case '<': return Token{kRedirIn, "<", pos};
    case '&': return Token{kAmp, "&", pos};
    case '>':
      if (!s.Eof() && s.Peek() == '>') {
        s.Bump();
        return Token{kRedirApp, ">>", pos};
      }
      return Token{kRedirOut, ">", pos};
    case '2':
      if (s.Eof() || s.Peek() != '>') throw Error(pos, "expected 2>");
      s.Bump();
      return Token{kRedirErr, "2>", pos};
    default:
      throw Error(pos, "unexpected operator");
  }
}

}  // namespace tinysh::lex
