#pragma once
#include "exec/proc.h"
#include "exec/shell.h"
#include <functional>
#include <vector>
namespace tinysh::exe {
int WithForegroundInterrupt(Shell& s, const std::vector<Proc>& procs, const std::function<int()>& fn);
}
