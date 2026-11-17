#include "parse/bg.h"
namespace tinysh::parse {
bool TakeBackground(Parser& p) {
  if (p.Kind() != lex::kAmp) return false;
  p.Bump();
  return true;
}
}
