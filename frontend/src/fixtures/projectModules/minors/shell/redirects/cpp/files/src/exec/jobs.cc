#include "exec/jobs.h"
#include "exec/spawn.h"
#include <csignal>
namespace tinysh::exe {
void AddJob(Shell& s, const std::vector<Proc>& procs) {
  s.PrintfErr("background jobs not supported yet\n");
  for (auto& p : procs) {
    kill(p.pid, SIGKILL);
    WaitCmd(p.pid, p.files);
  }
}
int BuiltinWait(Shell& s, const std::vector<std::string>& args) {
  (void)args;
  s.PrintfErr("wait: not supported yet\n");
  return 1;
}
}
