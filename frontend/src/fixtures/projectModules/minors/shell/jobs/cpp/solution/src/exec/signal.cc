#include "exec/signal.h"
#include <csignal>
#include <thread>
#include <unistd.h>
#include <atomic>

namespace tinysh::exe {

int WithForegroundInterrupt(Shell& s, const std::vector<Proc>& procs, const std::function<int()>& fn) {
  (void)s;
  std::atomic<int> status{-1};
  std::atomic<bool> finished{false};
  // Store procs for handler via static (simple hook for chapter).
  static thread_local const std::vector<Proc>* tl_procs = nullptr;
  tl_procs = &procs;
  auto prev = std::signal(SIGINT, [](int) {
    if (!tl_procs) return;
    for (auto& p : *tl_procs) {
      if (p.pid > 0) kill(p.pid, SIGINT);
    }
  });
  std::thread t([&] {
    status = fn();
    finished = true;
  });
  t.join();
  std::signal(SIGINT, prev);
  tl_procs = nullptr;
  return status.load();
}

}  // namespace tinysh::exe
