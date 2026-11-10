#include "exec/run.h"
#include "exec/path.h"
#include <stdexcept>
#include <sys/wait.h>
#include <unistd.h>
#include <vector>

namespace tinysh::exe {

pid_t StartProcess(Shell& s, const std::vector<std::string>& argv, Stdio io) {
  std::string path = LookPath(argv[0], s.dir, s.env);
  pid_t pid = fork();
  if (pid < 0) throw std::runtime_error("fork failed");
  if (pid == 0) {
    if (io.in != 0) { dup2(io.in, 0); if (io.in > 2) close(io.in); }
    if (io.out != 1) { dup2(io.out, 1); if (io.out > 2) close(io.out); }
    if (io.err != 2) { dup2(io.err, 2); if (io.err > 2) close(io.err); }
    // close other ends we don't need is caller's job before fork mostly
    std::vector<char*> av;
    av.push_back(const_cast<char*>(path.c_str()));
    for (size_t i = 1; i < argv.size(); ++i) av.push_back(const_cast<char*>(argv[i].c_str()));
    av.push_back(nullptr);
    std::vector<char*> ev;
    for (auto& e : s.env) ev.push_back(const_cast<char*>(e.c_str()));
    ev.push_back(nullptr);
    if (chdir(s.dir.c_str()) != 0) _exit(127);
    execve(path.c_str(), av.data(), ev.data());
    _exit(127);
  }
  return pid;
}

int WaitProcess(pid_t pid) {
  int st = 0;
  if (waitpid(pid, &st, 0) < 0) return 127;
  if (WIFEXITED(st)) return WEXITSTATUS(st);
  if (WIFSIGNALED(st)) return 128 + WTERMSIG(st);
  return 127;
}

}  // namespace tinysh::exe
