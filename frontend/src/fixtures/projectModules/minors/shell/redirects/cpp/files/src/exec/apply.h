#pragma once
#include "ast/ast.h"
#include "exec/proc.h"
#include <vector>

namespace tinysh::exe {
Stdio ApplyRedirsIO(Stdio base, const std::vector<ast::Redir>& redirs, const std::vector<int>& files);
}
