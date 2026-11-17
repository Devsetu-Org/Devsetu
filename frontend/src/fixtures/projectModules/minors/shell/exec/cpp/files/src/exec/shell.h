#pragma once
#include <condition_variable>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace tinysh::exe {

struct Job {
  std::mutex mu;
  std::condition_variable cv;
  bool done = false;
  int status = 0;
};

struct Shell {
  int stdin_fd = 0;
  int stdout_fd = 1;
  int stderr_fd = 2;
  bool use_capture = false;
  std::string* capture_out = nullptr;
  std::string* capture_err = nullptr;

  std::string dir;
  std::vector<std::string> env;

  std::unique_ptr<std::mutex> mu = std::make_unique<std::mutex>();
  std::vector<std::shared_ptr<Job>> jobs;
  bool exited_ = false;
  int status_ = 0;

  bool Exited();
  int LastStatus();
  void SetExit(int code);
  void PrintfErr(const char* fmt, ...);
  int RunLine(const std::string& line);
};

Shell New();

}  // namespace tinysh::exe
