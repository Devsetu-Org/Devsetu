#pragma once
#include "exec/proc.h"
#include "exec/shell.h"
#include <string>
#include <vector>
namespace tinysh::exe {
void AddJob(Shell& s, const std::vector<Proc>& procs);
int BuiltinWait(Shell& s, const std::vector<std::string>& args);
}
