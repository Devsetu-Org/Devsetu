#include "exec/signal.h"
namespace tinysh::exe {
int WithForegroundInterrupt(Shell& s, const std::vector<Proc>& procs, const std::function<int()>& fn) {
  (void)s; (void)procs; return fn();
}
}
