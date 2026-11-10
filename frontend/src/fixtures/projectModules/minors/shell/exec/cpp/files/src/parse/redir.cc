#include "parse/redir.h"
namespace tinysh::parse {
ast::Redir ParseRedir(Parser& p) {
  throw p.Errf("redirects not supported yet");
}
}
