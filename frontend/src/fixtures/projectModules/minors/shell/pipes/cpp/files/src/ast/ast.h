#pragma once
#include <string>
#include <vector>
#include "lex/token.h"

namespace tinysh::ast {

struct Redir {
  lex::Kind kind;
  std::string file;
};

struct Cmd {
  std::vector<std::string> argv;
  std::vector<Redir> redirs;
};

struct Pipeline {
  std::vector<Cmd> cmds;
  bool background = false;
};

}  // namespace tinysh::ast
