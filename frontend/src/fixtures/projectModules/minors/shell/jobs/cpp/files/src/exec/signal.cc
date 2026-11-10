#include "exec/signal.h"
#include <csignal>
#include <unistd.h>

namespace tinysh::exe {

int WithForegroundInterrupt(Shell& s, const std::vector<Proc>& procs, const std::function<int()>& fn) {
  // The pass-through keeps ordinary tests green. Replace the body for TODO(5.3).
  (void)s;
  (void)procs;
  (void)SIGINT;
  // TODO(5.3): Notify on SIGINT, run fn, forward SIGINT to children.
  return fn();
}

}  // namespace tinysh::exe
