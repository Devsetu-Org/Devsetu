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
      // TODO(1.2)
      throw std::runtime_error("TODO(1.2)");
    } else if (c == '\'') {
      // TODO(1.1)
      throw std::runtime_error("TODO(1.1)");
    } else if (c == '"') {
      // TODO(1.1)
      throw std::runtime_error("TODO(1.1)");
    } else {
      // TODO(1.1)
      throw std::runtime_error("TODO(1.1)");
    }
  }
  (void)start;
  (void)b;
  // TODO(1.1)
  throw std::runtime_error("TODO(1.1)");
}

Token ScanOp(Scanner& s) {
  // TODO(1.3)
  (void)s;
  throw std::runtime_error("TODO(1.3)");
}

}  // namespace tinysh::lex
