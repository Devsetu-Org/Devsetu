#include "exec/pipe.h"
#include "exec/builtin.h"
#include "exec/builtin_redir.h"
#include "exec/jobs.h"
#include "exec/signal.h"
#include "exec/spawn.h"
#include "exec/wait.h"
#include <unistd.h>
#include <stdexcept>

#include <csignal>
namespace tinysh::exe {

static void CleanupPipes(std::vector<std::pair<int, int>>& pipes) {
  for (auto& p : pipes) {
    if (p.first >= 0) close(p.first);
    if (p.second >= 0) close(p.second);
  }
}

int RunPipeline(Shell& s, const ast::Pipeline& pl) {
  if (pl.cmds.empty()) return 0;
  if (pl.cmds.size() == 1 && !pl.background && !pl.cmds[0].argv.empty() &&
      IsBuiltin(pl.cmds[0].argv[0])) {
    return RunBuiltinWithRedirs(s, pl.cmds[0]);
  }
  auto wired = WirePipes(s, pl);
  auto& procs = wired.first;
  int errStatus = wired.second;
  if (procs.empty() && errStatus != -1) return errStatus;
  if (pl.background) {
    AddJob(s, procs);
    return 0;
  }
  return WithForegroundInterrupt(s, procs, [&s, &procs] { return WaitForeground(s, procs); });
}

static void CleanupPipes(std::vector<std::pair<int, int>>& pipes) {
  for (auto& p : pipes) {
    if (p.first >= 0) close(p.first);
    if (p.second >= 0) close(p.second);
  }
}

std::pair<std::vector<Proc>, int> WirePipes(Shell& s, const ast::Pipeline& pl) {
  size_t n = pl.cmds.size();
  if (n == 1) {
    auto& cmd = pl.cmds[0];
    if (cmd.argv.empty()) {
      s.PrintfErr("missing command\n");
      return {{}, 1};
    }
    try {
      auto started = StartCmd(s, cmd, Stdio{s.stdin_fd, s.stdout_fd, s.stderr_fd});
      return {{Proc{started.first, started.second}}, -1};
    } catch (const std::exception& e) {
      s.PrintfErr("%s: %s\n", cmd.argv[0].c_str(), e.what());
      return {{}, 127};
    }
  }
  // TODO(4.2): For n > 1, create pipe() between neighbours, StartCmd each stage,
  // close unused ends in the parent, and return the procs.
  (void)CleanupPipes;
  throw std::runtime_error("TODO(4.2): WirePipes");
}

}  // namespace tinysh::exe
