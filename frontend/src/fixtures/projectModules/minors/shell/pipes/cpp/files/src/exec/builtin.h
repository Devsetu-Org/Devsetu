#pragma once
#include "exec/shell.h"
#include <string>
#include <vector>
#include <utility>

namespace tinysh::exe {
bool IsBuiltin(const std::string& name);
std::pair<int, bool> RunBuiltin(Shell& s, const std::vector<std::string>& argv);
int BuiltinCd(Shell& s, const std::vector<std::string>& args);
int BuiltinExit(Shell& s, const std::vector<std::string>& args);
}
