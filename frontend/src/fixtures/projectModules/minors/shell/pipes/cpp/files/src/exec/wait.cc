#include "exec/wait.h"
#include "exec/spawn.h"
#include <stdexcept>
namespace tinysh::exe {
int WaitForeground(Shell& s, const std::vector<Proc>& procs) {
  // TODO(4.3)
  (void)s; (void)procs;
  // TODO(4.3)
  throw std::runtime_error("TODO(4.3)");
}
}
