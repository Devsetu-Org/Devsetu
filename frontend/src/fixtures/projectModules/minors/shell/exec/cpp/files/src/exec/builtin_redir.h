#pragma once
#include "ast/ast.h"
#include "exec/shell.h"
namespace tinysh::exe {
int RunBuiltinWithRedirs(Shell& s, const ast::Cmd& cmd);
}
