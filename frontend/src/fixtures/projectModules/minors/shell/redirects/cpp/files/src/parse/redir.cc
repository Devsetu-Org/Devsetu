#include "parse/redir.h"
#include <stdexcept>
namespace tinysh::parse {
ast::Redir ParseRedir(Parser& p) {
  // TODO(3.1): Record Kind, Bump, require Word, return Redir.
  (void)p;
  throw std::runtime_error("TODO(3.1): ParseRedir");
}
}
