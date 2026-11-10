#include "exec/apply.h"
#include <stdexcept>

namespace tinysh::exe {

Stdio ApplyRedirsIO(Stdio base, const std::vector<ast::Redir>& redirs, const std::vector<int>& files) {
  // TODO(3.3): For each redir, assign files[i] onto in, out, or err by Kind.
  (void)redirs; (void)files;
  throw std::runtime_error("TODO(3.3): ApplyRedirsIO");
}

}  // namespace tinysh::exe
