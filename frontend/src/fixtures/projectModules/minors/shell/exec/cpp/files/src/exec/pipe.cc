#include "exec/pipe.h"
#include "exec/builtin.h"
#include "exec/builtin_redir.h"
#include "exec/spawn.h"

namespace tinysh::exe {

int RunPipeline(Shell& s, const ast::Pipeline& pl) {
  if (pl.cmds.empty()) return 0;
  if (pl.background) {
    s.PrintfErr("background jobs not supported yet\n");
    return 1;
  }
  if (pl.cmds.size() != 1) {
    s.PrintfErr("pipelines not supported yet\n");
    return 1;
  }
  auto& cmd = pl.cmds[0];
  if (cmd.argv.empty()) {
    s.PrintfErr("missing command\n");
    return 1;
  }
  if (IsBuiltin(cmd.argv[0])) return RunBuiltinWithRedirs(s, cmd);
  try {
    auto started = StartCmd(s, cmd, Stdio{s.stdin_fd, s.stdout_fd, s.stderr_fd});
    return WaitCmd(started.first, started.second);
  } catch (const std::exception& e) {
    s.PrintfErr("%s: %s\n", cmd.argv[0].c_str(), e.what());
    return 127;
  }
}

std::pair<std::vector<Proc>, int> WirePipes(Shell& s, const ast::Pipeline& pl) {
  (void)s; (void)pl;
  return {{}, 1};
}

}  // namespace tinysh::exe
