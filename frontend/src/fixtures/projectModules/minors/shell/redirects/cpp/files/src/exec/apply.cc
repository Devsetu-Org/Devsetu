#include "exec/apply.h"
#include <stdexcept>

namespace tinysh::exe {

Stdio ApplyRedirsIO(Stdio base, const std::vector<ast::Redir>& redirs, const std::vector<int>& files) {
  // TODO(3.3)
  (void)redirs; (void)files;
  // TODO(3.3)
  throw std::runtime_error("TODO(3.3)");
}

}  // namespace tinysh::exe
