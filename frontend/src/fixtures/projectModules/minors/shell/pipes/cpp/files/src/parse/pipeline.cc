#include "parse/pipeline.h"
#include <stdexcept>
namespace tinysh::parse {
std::vector<ast::Cmd> SplitPipeline(Parser& p) {
  auto cmd = p.Cmd();
  std::vector<ast::Cmd> cmds{cmd};
  if (p.Kind() != lex::kPipe) return cmds;
  // TODO(4.1): While the next token is Pipe, bump and parse another cmd.
  throw std::runtime_error("TODO(4.1): SplitPipeline");
}
}
