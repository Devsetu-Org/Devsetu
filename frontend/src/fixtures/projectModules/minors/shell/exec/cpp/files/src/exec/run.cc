#include "exec/run.h"
#include "exec/path.h"
#include <sys/wait.h>
#include <unistd.h>
#include <stdexcept>
#include <vector>

namespace tinysh::exe {

pid_t StartProcess(Shell& s, const std::vector<std::string>& argv, Stdio io) {
  // TODO(2.2): LookPath argv[0], fork, dup2 stdio in the child, execve.
  (void)s; (void)argv; (void)io;
  throw std::runtime_error("TODO(2.2): StartProcess");
}

int WaitProcess(pid_t pid) {
  // TODO(2.2): waitpid and map to an exit status.
  (void)pid;
  throw std::runtime_error("TODO(2.2): WaitProcess");
}

}  // namespace tinysh::exe
