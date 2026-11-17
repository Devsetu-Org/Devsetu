#include "parse/pipeline.h"
namespace tinysh::parse {
std::vector<ast::Cmd> SplitPipeline(Parser& p) {
  std::vector<ast::Cmd> cmds;
  for (;;) {
    cmds.push_back(p.Cmd());
    if (p.Kind() != lex::kPipe) break;
    p.Bump();
    if (p.Kind() == lex::kEOF || p.Kind() == lex::kAmp || p.Kind() == lex::kPipe)
      throw p.Errf("missing command after |");
  }
  return cmds;
}
}
