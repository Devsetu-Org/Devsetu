#include "parse/ast.h"
#include <sstream>

namespace sqlq {
namespace parse {

std::string Name(const Expr* e) {
  if (auto* i = dynamic_cast<const Ident*>(e)) return i->name;
  if (auto* q = dynamic_cast<const Qual*>(e)) return q->table + "." + q->name;
  if (auto* n = dynamic_cast<const IntLit*>(e)) return std::to_string(n->v);
  if (auto* s = dynamic_cast<const StrLit*>(e)) return "'" + s->v + "'";
  if (auto* c = dynamic_cast<const Call*>(e)) {
    if (c->star) return "count(*)";
    return c->name + "(" + Name(c->arg.get()) + ")";
  }
  if (auto* b = dynamic_cast<const Binary*>(e)) return Name(b->left.get()) + " " + b->op + " " + Name(b->right.get());
  return "?";
}

}  // namespace parse
}  // namespace sqlq
