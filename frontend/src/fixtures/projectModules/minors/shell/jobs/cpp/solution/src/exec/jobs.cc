#include "exec/jobs.h"
#include "exec/spawn.h"
#include <thread>

namespace tinysh::exe {

void AddJob(Shell& s, const std::vector<Proc>& procs) {
  auto j = std::make_shared<Job>();
  {
    std::lock_guard<std::mutex> lock(*s.mu);
    s.jobs.push_back(j);
  }
  std::thread([j, procs]() {
    int status = 0;
    for (size_t i = 0; i < procs.size(); ++i) {
      int st = WaitCmd(procs[i].pid, procs[i].files);
      if (i + 1 == procs.size()) status = st;
    }
    {
      std::lock_guard<std::mutex> lock(j->mu);
      j->status = status;
      j->done = true;
    }
    j->cv.notify_all();
  }).detach();
}

int BuiltinWait(Shell& s, const std::vector<std::string>& args) {
  if (!args.empty()) {
    s.PrintfErr("wait: arguments not supported\n");
    return 1;
  }
  std::vector<std::shared_ptr<Job>> jobs;
  {
    std::lock_guard<std::mutex> lock(*s.mu);
    jobs = s.jobs;
    s.jobs.clear();
  }
  int status = 0;
  for (auto& j : jobs) {
    std::unique_lock<std::mutex> lock(j->mu);
    j->cv.wait(lock, [&] { return j->done; });
    status = j->status;
  }
  return status;
}

}  // namespace tinysh::exe
