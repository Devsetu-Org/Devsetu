#pragma once
#include <exception>
#include <string>
#include <vector>
#include "ast/ast.h"
#include "lex/token.h"

namespace tinysh::parse {

struct Error : std::exception {
  int pos;
  std::string msg;
  Error(int p, std::string m) : pos(p), msg(std::move(m)) {}
  const char* what() const noexcept override { return msg.c_str(); }
};

struct Parser {
  std::vector<lex::Token> toks;
  int i = 0;
  lex::Kind Kind() const;
  lex::Token Bump();
  Error Errf(const std::string& msg) const;
  ast::Pipeline Pipeline();
  ast::Cmd Cmd();
};

ast::Pipeline Parse(const std::vector<lex::Token>& toks);

}  // namespace tinysh::parse
