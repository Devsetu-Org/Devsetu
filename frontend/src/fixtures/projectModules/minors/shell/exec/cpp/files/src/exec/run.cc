#include "exec/run.h"
#include "exec/path.h"
#include <sys/wait.h>
#include <unistd.h>
#include <stdexcept>
#include <vector>

namespace tinysh::exe {

pid_t StartProcess(Shell& s, const std::vector<std::string>& argv, Stdio io) {
  // TODO(2.2)
  (void)s; (void)argv; (void)io;
  // TODO(2.2)
  throw std::runtime_error("TODO(2.2)");
}

int WaitProcess(pid_t pid) {
  // TODO(2.2)
  (void)pid;
  throw std::runtime_error("TODO(2.2)");
}

}  // namespace tinysh::exe
