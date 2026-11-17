#include "exec/jobs.h"
#include "exec/spawn.h"
#include <thread>
#include <stdexcept>

namespace tinysh::exe {

void AddJob(Shell& s, const std::vector<Proc>& procs) {
  // TODO(5.1)
  (void)s; (void)procs;
  // TODO(5.1)
  throw std::runtime_error("TODO(5.1)");
}

int BuiltinWait(Shell& s, const std::vector<std::string>& args) {
  // TODO(5.2)
  (void)s; (void)args;
  // TODO(5.2)
  throw std::runtime_error("TODO(5.2)");
}

}  // namespace tinysh::exe
