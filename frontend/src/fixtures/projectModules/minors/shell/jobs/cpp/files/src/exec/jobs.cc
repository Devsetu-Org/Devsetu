#include "exec/jobs.h"
#include "exec/spawn.h"
#include <thread>
#include <stdexcept>

namespace tinysh::exe {

void AddJob(Shell& s, const std::vector<Proc>& procs) {
  // TODO(5.1): Create a Job, append under s.mu, wait in a thread, notify done.
  (void)s; (void)procs;
  throw std::runtime_error("TODO(5.1): AddJob");
}

int BuiltinWait(Shell& s, const std::vector<std::string>& args) {
  // TODO(5.2): Reject args. Drain s.jobs, wait for each, return last status.
  (void)s; (void)args;
  throw std::runtime_error("TODO(5.2): BuiltinWait");
}

}  // namespace tinysh::exe
