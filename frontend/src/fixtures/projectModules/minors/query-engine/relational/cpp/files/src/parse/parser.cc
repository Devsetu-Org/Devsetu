#include "parse/parser.h"
#include "lex/lex.h"
#include <stdexcept>

namespace sqlq {
namespace parse {

bool Parser::Eat(lex::Kind k) {
  if (!At(k)) return false;
  ++i_;
  return true;
}

lex::Token Parser::Expect(lex::Kind k) {
  auto t = Peek();
  if (t.kind != k) throw Errorf(std::string("expected ") + lex::KindName(k));
  ++i_;
  return t;
}

ParseError Parser::Errorf(const std::string& msg) const {
  return ParseError("at " + std::to_string(Peek().pos) + ": " + msg);
}

std::unique_ptr<Stmt> Parser::ParseStmt() {
  if (At(lex::Kind::kKwCreate)) return ParseCreate(*this);
  if (At(lex::Kind::kKwInsert)) return ParseInsert(*this);
  if (At(lex::Kind::kKwSelect)) return ParseSelect(*this);
  throw Errorf("expected a statement");
}

void Parser::ParseFromTail(Select* s) {
  if (At(lex::Kind::kKwInner) || At(lex::Kind::kKwJoin)) s->join = ParseJoin(*this);
}

void Parser::FinishSelect(Select* s) { ParseTail(*this, s); }

std::unique_ptr<Stmt> Parse(const std::string& src) {
  auto toks = lex::Scan(src);
  Parser p(std::move(toks));
  auto stmt = p.ParseStmt();
  p.Eat(lex::Kind::kSemicolon);
  if (!p.At(lex::Kind::kEof)) throw p.Errorf(std::string("unexpected token ") + lex::KindName(p.Peek().kind));
  return stmt;
}

int64_t ParseInt(const std::string& lit) { return std::stoll(lit); }

}  // namespace parse
}  // namespace sqlq
