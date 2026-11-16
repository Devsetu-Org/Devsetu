#include "exec/signal.h"
#include <csignal>
#include <unistd.h>

namespace tinysh::exe {

int WithForegroundInterrupt(Shell& s, const std::vector<Proc>& procs, const std::function<int()>& fn) {
  (void)s;
  (void)procs;
  (void)SIGINT;
  // TODO(5.3)
  return fn();
}

}  // namespace tinysh::exe
