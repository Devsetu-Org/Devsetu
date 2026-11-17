#include "execute/row.h"
#include <stdexcept>

namespace sqlq {
namespace execute {

using catalog::Bool;
using catalog::Int;
using catalog::Text;
using catalog::Type;
using catalog::Value;

static Value EvalBinary(const parse::Binary* v, const Row& row);

Value Eval(const parse::Expr* e, const Row& row) {
  if (auto* n = dynamic_cast<const parse::IntLit*>(e)) return Int(n->v);
  if (auto* s = dynamic_cast<const parse::StrLit*>(e)) return Text(s->v);
  if (auto* id = dynamic_cast<const parse::Ident*>(e)) {
    auto [val, ok] = row.Get(id->name);
    if (!ok) throw std::runtime_error("no column " + id->name);
    return val;
  }
  if (auto* q = dynamic_cast<const parse::Qual*>(e)) {
    auto [val, ok] = row.Get(q->table + "." + q->name);
    if (!ok) std::tie(val, ok) = row.Get(q->name);
    if (!ok) throw std::runtime_error("no column " + q->table + "." + q->name);
    return val;
  }
  if (auto* b = dynamic_cast<const parse::Binary*>(e)) return EvalBinary(b, row);
  if (auto* c = dynamic_cast<const parse::Call*>(e))
    throw std::runtime_error("aggregate " + c->name + " is not allowed here");
  throw std::runtime_error("bad expression");
}

static Value EvalBinary(const parse::Binary* v, const Row& row) {
  Value left = Eval(v->left.get(), row);
  if (v->op == "AND") {
    if (left.t != Type::kBool) throw std::runtime_error("AND needs booleans");
    if (!left.b) return Bool(false);
    Value right = Eval(v->right.get(), row);
    if (right.t != Type::kBool) throw std::runtime_error("AND needs booleans");
    return Bool(right.b);
  }
  Value right = Eval(v->right.get(), row);
  if (left.t != right.t || (left.t != Type::kInt && left.t != Type::kText))
    throw std::runtime_error("cannot compare those types");
  int cmp = 0;
  if (left.t == Type::kInt) {
    if (left.i < right.i) cmp = -1;
    else if (left.i > right.i) cmp = 1;
  } else {
    if (left.s < right.s) cmp = -1;
    else if (left.s > right.s) cmp = 1;
  }
  bool ok = false;
  if (v->op == "=") ok = cmp == 0;
  else if (v->op == "<") ok = cmp < 0;
  else if (v->op == ">") ok = cmp > 0;
  else throw std::runtime_error("bad operator " + v->op);
  return Bool(ok);
}

bool Truth(const parse::Expr* e, const Row& row) {
  Value v = Eval(e, row);
  if (v.t != Type::kBool) throw std::runtime_error("WHERE must be a comparison");
  return v.b;
}

}  // namespace execute
}  // namespace sqlq
