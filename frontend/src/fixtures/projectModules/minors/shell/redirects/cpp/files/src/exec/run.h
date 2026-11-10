#pragma once
#include <string>
#include <vector>
#include "exec/proc.h"
#include "exec/shell.h"

namespace tinysh::exe {

pid_t StartProcess(Shell& s, const std::vector<std::string>& argv, Stdio io);
int WaitProcess(pid_t pid);

}  // namespace tinysh::exe
