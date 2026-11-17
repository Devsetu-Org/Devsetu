#pragma once
#include "ast/ast.h"
#include "exec/proc.h"
#include "exec/shell.h"
#include <utility>

namespace tinysh::exe {
std::pair<pid_t, std::vector<int>> StartCmd(Shell& s, const ast::Cmd& cmd, Stdio base);
int WaitCmd(pid_t pid, const std::vector<int>& files);
}
