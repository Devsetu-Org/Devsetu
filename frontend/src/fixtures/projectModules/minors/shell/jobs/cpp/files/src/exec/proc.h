#pragma once
#include <vector>
#include <unistd.h>

namespace tinysh::exe {

struct Proc {
  pid_t pid = -1;
  std::vector<int> files;  // fds to close after wait
};

struct Stdio {
  int in = 0;
  int out = 1;
  int err = 2;
};

}  // namespace tinysh::exe
