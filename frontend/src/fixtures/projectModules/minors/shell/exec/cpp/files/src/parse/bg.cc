#include "parse/bg.h"
namespace tinysh::parse {
bool TakeBackground(Parser& p) {
  if (p.Kind() == lex::kAmp) throw p.Errf("background jobs not supported yet");
  return false;
}
}
