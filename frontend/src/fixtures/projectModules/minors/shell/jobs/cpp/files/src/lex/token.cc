#include "lex/token.h"

namespace tinysh::lex {

static const char* kNames[] = {
    "illegal", "eof", "word", "pipe", "redir_out", "redir_app", "redir_in", "redir_err", "amp",
};

const char* KindName(Kind k) {
  int i = static_cast<int>(k);
  if (i >= 0 && i < 9) return kNames[i];
  return "illegal";
}

}  // namespace tinysh::lex
