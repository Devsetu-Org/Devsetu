#include "lex/scan.h"
#include <stdexcept>

namespace tinysh::lex {

Token ScanWord(Scanner& s) {
  int start = s.i;
  std::string b;
  while (!s.Eof()) {
    char c = s.Peek();
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') break;
    if (OpStart(c, s.PeekAt(1))) break;
    if (c == '\\') {
      // TODO(1.2): bump past the backslash; on EOF throw trailing-backslash;
      // otherwise append the next bumped byte to b and continue.
      throw std::runtime_error("TODO(1.2): backslash escape");
    } else if (c == '\'') {
      // TODO(1.1): bump past opening quote; append bytes until closing quote.
      throw std::runtime_error("TODO(1.1): single-quoted word");
    } else if (c == '"') {
      // TODO(1.1): bump past opening quote; append until closing quote.
      // Inside, backslash escapes the next byte (TODO 1.2 shares this path).
      throw std::runtime_error("TODO(1.1): double-quoted word");
    } else {
      // TODO(1.1): append Bump() to b.
      throw std::runtime_error("TODO(1.1): unquoted character");
    }
  }
  (void)start;
  (void)b;
  throw std::runtime_error("TODO(1.1): return Word token");
}

Token ScanOp(Scanner& s) {
  // TODO(1.3): Map | < & > >> and 2> to the operator kinds.
  (void)s;
  throw std::runtime_error("TODO(1.3): ScanOp");
}

}  // namespace tinysh::lex
