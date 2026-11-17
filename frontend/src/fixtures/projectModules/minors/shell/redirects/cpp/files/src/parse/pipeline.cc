#include "parse/pipeline.h"
namespace tinysh::parse {
std::vector<ast::Cmd> SplitPipeline(Parser& p) {
  if (p.Kind() == lex::kPipe) throw p.Errf("pipelines not supported yet");
  auto cmd = p.Cmd();
  if (p.Kind() == lex::kPipe) throw p.Errf("pipelines not supported yet");
  return {cmd};
}
}
