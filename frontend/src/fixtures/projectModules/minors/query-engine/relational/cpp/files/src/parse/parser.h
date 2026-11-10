#pragma once
#include <stdexcept>
#include <memory>
#include <string>
#include <vector>
#include "lex/token.h"
#include "parse/ast.h"

namespace sqlq {
namespace parse {

struct ParseError : public std::runtime_error {
  using std::runtime_error::runtime_error;
};

class Parser {
 public:
  explicit Parser(std::vector<lex::Token> toks) : toks_(std::move(toks)) {}
  lex::Token Peek() const { return toks_[i_]; }
  bool At(lex::Kind k) const { return Peek().kind == k; }
  bool Eat(lex::Kind k);
  lex::Token Expect(lex::Kind k);
  ParseError Errorf(const std::string& msg) const;
  std::unique_ptr<Stmt> ParseStmt();
  void ParseFromTail(Select* s);
  void FinishSelect(Select* s);

  std::vector<lex::Token> toks_;
  int i_ = 0;
};

std::unique_ptr<Stmt> Parse(const std::string& src);
int64_t ParseInt(const std::string& lit);

std::unique_ptr<Expr> ParseExpr(Parser& p);
std::unique_ptr<Expr> ParseAnd(Parser& p);
std::unique_ptr<Expr> ParseCmp(Parser& p);
std::unique_ptr<Expr> ParsePrimary(Parser& p);
std::unique_ptr<Expr> ParseCall(Parser& p, const std::string& name, bool allow_star);
std::unique_ptr<Select> ParseSelect(Parser& p);
SelectItem ParseSelectItem(Parser& p);
std::string ParseAlias(Parser& p);
std::unique_ptr<CreateTable> ParseCreate(Parser& p);
TypeName ParseType(Parser& p);
std::unique_ptr<Insert> ParseInsert(Parser& p);
void ParseTail(Parser& p, Select* s);
std::unique_ptr<Join> ParseJoin(Parser& p);

}  // namespace parse
}  // namespace sqlq
