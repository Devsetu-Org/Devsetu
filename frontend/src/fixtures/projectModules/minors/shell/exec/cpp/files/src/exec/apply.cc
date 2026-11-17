#include "exec/apply.h"
namespace tinysh::exe {
Stdio ApplyRedirsIO(Stdio base, const std::vector<ast::Redir>& redirs, const std::vector<int>& files) {
  (void)redirs; (void)files; return base;
}
}
