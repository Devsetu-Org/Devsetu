#pragma once
#include "ast/ast.h"
#include "exec/proc.h"
#include "exec/shell.h"
#include <utility>
#include <vector>
namespace tinysh::exe {
int RunPipeline(Shell& s, const ast::Pipeline& pl);
std::pair<std::vector<Proc>, int> WirePipes(Shell& s, const ast::Pipeline& pl);
}
