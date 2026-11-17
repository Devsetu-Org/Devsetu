#include "exec/pipe.h"
#include "exec/builtin.h"
#include "exec/builtin_redir.h"
#include "exec/jobs.h"
#include "exec/signal.h"
#include "exec/spawn.h"
#include "exec/wait.h"
#include <unistd.h>

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

std::pair<std::vector<Proc>, int> WirePipes(Shell& s, const ast::Pipeline& pl) {
  size_t n = pl.cmds.size();
  std::vector<Proc> procs(n);
  std::vector<std::pair<int, int>> pipes;

  for (size_t i = 0; i < n; ++i) {
    auto& cmd = pl.cmds[i];
    if (cmd.argv.empty()) {
      s.PrintfErr("missing command\n");
      CleanupPipes(pipes);
      return {{}, 1};
    }
    if (IsBuiltin(cmd.argv[0]) && (n > 1 || pl.background)) {
      s.PrintfErr("%s: builtin not allowed in pipeline or background\n", cmd.argv[0].c_str());
      CleanupPipes(pipes);
      return {{}, 1};
    }
    Stdio base{s.stdin_fd, s.stdout_fd, s.stderr_fd};
    if (i > 0) base.in = pipes[i - 1].first;
    if (i + 1 < n) {
      int fds[2];
      if (pipe(fds) != 0) {
        s.PrintfErr("pipe: failed\n");
        CleanupPipes(pipes);
        return {{}, 1};
      }
      pipes.push_back({fds[0], fds[1]});
      base.out = fds[1];
    }
    try {
      auto [pid, files] = StartCmd(s, cmd, base);
      procs[i] = Proc{pid, files};
    } catch (const std::exception& e) {
      s.PrintfErr("%s: %s\n", cmd.argv[0].c_str(), e.what());
      CleanupPipes(pipes);
      for (size_t j = 0; j < i; ++j) {
        kill(procs[j].pid, SIGKILL);
        WaitCmd(procs[j].pid, procs[j].files);
      }
      return {{}, 127};
    }
    if (i + 1 < n) {
      close(pipes[i].second);
      pipes[i].second = -1;
    }
    if (i > 0) {
      close(pipes[i - 1].first);
      pipes[i - 1].first = -1;
    }
  }
  return {procs, -1};
}

}  // namespace tinysh::exe
