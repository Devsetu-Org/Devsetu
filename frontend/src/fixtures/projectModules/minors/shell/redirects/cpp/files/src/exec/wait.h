#pragma once
#include "exec/proc.h"
#include "exec/shell.h"
#include <vector>
namespace tinysh::exe {
int WaitForeground(Shell& s, const std::vector<Proc>& procs);
}
