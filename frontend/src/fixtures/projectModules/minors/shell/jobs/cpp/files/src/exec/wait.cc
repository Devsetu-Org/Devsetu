#include "exec/wait.h"
#include "exec/spawn.h"
namespace tinysh::exe {
int WaitForeground(Shell& s, const std::vector<Proc>& procs) {
  (void)s;
  int status = 0;
  for (size_t i = 0; i < procs.size(); ++i) {
    int st = WaitCmd(procs[i].pid, procs[i].files);
    if (i + 1 == procs.size()) status = st;
  }
  return status;
}
}
