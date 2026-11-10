#include "exec/spawn.h"
#include "exec/apply.h"
#include "exec/open.h"
#include "exec/run.h"

namespace tinysh::exe {

std::pair<pid_t, std::vector<int>> StartCmd(Shell& s, const ast::Cmd& cmd, Stdio base) {
  auto files = OpenRedirs(s.dir, cmd.redirs);
  Stdio io = ApplyRedirsIO(base, cmd.redirs, files);
  try {
    pid_t pid = StartProcess(s, cmd.argv, io);
    return {pid, files};
  } catch (...) {
    CloseAll(files);
    throw;
  }
}

int WaitCmd(pid_t pid, const std::vector<int>& files) {
  int st = WaitProcess(pid);
  CloseAll(files);
  return st;
}

}  // namespace tinysh::exe
