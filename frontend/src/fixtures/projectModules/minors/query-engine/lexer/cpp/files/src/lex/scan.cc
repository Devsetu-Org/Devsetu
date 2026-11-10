#include "lex/lex.h"

namespace sqlq {
namespace lex {

Token ScanIdent(Scanner& s) {
  // TODO(1.1): From s.i_, read while IsIdentPart(s.Peek()) using Bump.
  // Return Token{Keyword(lit), lit, start}. lit keeps the original case.
  throw Error(s.i_, "TODO(1.1): ScanIdent");
}

Token ScanNumber(Scanner& s) {
  // TODO(1.2): Read while IsDigit(s.Peek()). Return Token{Kind::kInt, lit, start}.
  throw Error(s.i_, "TODO(1.2): ScanNumber");
}

Token ScanString(Scanner& s) {
  // TODO(1.2): Skip the opening quote. Append bytes until the closing quote.
  // A doubled quote ('') is one quote in the literal. Newline or EOF throws
  // Error(start, "unterminated string"). Kind is kString, lit is the decoded text.
  throw Error(s.i_, "TODO(1.2): ScanString");
}

Token ScanSymbol(Scanner& s) {
  // TODO(1.3): Map * , ( ) = < > ; . to the matching Kind.
  // Anything else is Error(pos, "unexpected character").
  throw Error(s.i_, "TODO(1.3): ScanSymbol");
}

}  // namespace lex
}  // namespace sqlq
