#include "parse/redir.h"
namespace tinysh::parse {
ast::Redir ParseRedir(Parser& p) {
  lex::Kind k = p.Kind();
  p.Bump();
  if (p.Kind() != lex::kWord) throw p.Errf("expected filename after redirect");
  return ast::Redir{k, p.Bump().lit};
}
}
