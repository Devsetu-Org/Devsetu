#pragma once
#include <vector>
#include "ast/ast.h"
#include "exec/proc.h"

namespace tinysh::exe {
std::vector<int> OpenRedirs(const std::string& dir, const std::vector<ast::Redir>& redirs);
int OpenOne(const std::string& dir, const ast::Redir& r);
void CloseAll(const std::vector<int>& files);
}
