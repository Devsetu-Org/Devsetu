#pragma once
#include <memory>
#include <string>
#include <vector>

namespace sqlq {
namespace parse {

enum class TypeName { kInt, kText };

struct Expr {
  virtual ~Expr() = default;
};
struct Ident : Expr { std::string name; explicit Ident(std::string n) : name(std::move(n)) {} };
struct Qual : Expr { std::string table, name; Qual(std::string t, std::string n) : table(std::move(t)), name(std::move(n)) {} };
struct IntLit : Expr { int64_t v; explicit IntLit(int64_t x) : v(x) {} };
struct StrLit : Expr { std::string v; explicit StrLit(std::string x) : v(std::move(x)) {} };
struct Binary : Expr {
  std::string op;
  std::unique_ptr<Expr> left, right;
  Binary(std::string o, std::unique_ptr<Expr> l, std::unique_ptr<Expr> r)
      : op(std::move(o)), left(std::move(l)), right(std::move(r)) {}
};
struct Call : Expr {
  std::string name;
  std::unique_ptr<Expr> arg;
  bool star = false;
};

struct Stmt { virtual ~Stmt() = default; };
struct Column { std::string name; TypeName type; };
struct CreateTable : Stmt { std::string name; std::vector<Column> cols; };
struct Insert : Stmt {
  std::string table;
  std::vector<std::vector<std::unique_ptr<Expr>>> rows;
};
struct SelectItem {
  std::unique_ptr<Expr> expr;
  std::string alias;
  bool star = false;
};
struct OrderKey { std::unique_ptr<Expr> expr; bool desc = false; };
struct Join {
  std::string table, alias;
  std::unique_ptr<Expr> left, right;
};
struct Select : Stmt {
  std::vector<SelectItem> items;
  std::string from;
  std::string alias;
  std::unique_ptr<Expr> where;
  std::unique_ptr<Join> join;
  std::vector<std::unique_ptr<Expr>> group;
  std::vector<OrderKey> order;
  bool has_limit = false;
  int64_t limit = 0;
};

std::string Name(const Expr* e);

}  // namespace parse
}  // namespace sqlq
