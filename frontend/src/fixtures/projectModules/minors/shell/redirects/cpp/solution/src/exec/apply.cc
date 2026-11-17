#include "exec/apply.h"

namespace tinysh::exe {

Stdio ApplyRedirsIO(Stdio base, const std::vector<ast::Redir>& redirs, const std::vector<int>& files) {
  Stdio out = base;
  for (size_t i = 0; i < redirs.size(); ++i) {
    switch (redirs[i].kind) {
      case lex::kRedirIn: out.in = files[i]; break;
      case lex::kRedirOut:
      case lex::kRedirApp: out.out = files[i]; break;
      case lex::kRedirErr: out.err = files[i]; break;
      default: break;
    }
  }
  return out;
}

}  // namespace tinysh::exe
