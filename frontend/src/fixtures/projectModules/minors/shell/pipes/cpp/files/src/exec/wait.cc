#include "exec/wait.h"
#include "exec/spawn.h"
#include <stdexcept>
namespace tinysh::exe {
int WaitForeground(Shell& s, const std::vector<Proc>& procs) {
  // TODO(4.3): WaitCmd each proc; return the last status.
  (void)s; (void)procs;
  throw std::runtime_error("TODO(4.3): WaitForeground");
}
}
