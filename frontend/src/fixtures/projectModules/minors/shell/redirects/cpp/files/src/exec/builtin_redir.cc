#include "exec/builtin_redir.h"
#include "exec/apply.h"
#include "exec/builtin.h"
#include "exec/open.h"

namespace tinysh::exe {

int RunBuiltinWithRedirs(Shell& s, const ast::Cmd& cmd) {
  if (cmd.redirs.empty()) {
    auto [st, ok] = RunBuiltin(s, cmd.argv);
    return st;
  }
  auto files = OpenRedirs(s.dir, cmd.redirs);
  int old_in = s.stdin_fd, old_out = s.stdout_fd, old_err = s.stderr_fd;
  Stdio io = ApplyRedirsIO(Stdio{s.stdin_fd, s.stdout_fd, s.stderr_fd}, cmd.redirs, files);
  s.stdin_fd = io.in;
  s.stdout_fd = io.out;
  s.stderr_fd = io.err;
  auto [st, ok] = RunBuiltin(s, cmd.argv);
  s.stdin_fd = old_in;
  s.stdout_fd = old_out;
  s.stderr_fd = old_err;
  CloseAll(files);
  return st;
}

}  // namespace tinysh::exe
