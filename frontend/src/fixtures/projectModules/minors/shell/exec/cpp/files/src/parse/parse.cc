#include "parse/parse.h"
#include "parse/bg.h"
#include "parse/pipeline.h"
#include "parse/redir.h"

namespace tinysh::parse {

lex::Kind Parser::Kind() const {
  if (i >= static_cast<int>(toks.size())) return lex::kEOF;
  return toks[i].kind;
}

lex::Token Parser::Bump() { return toks[i++]; }

Error Parser::Errf(const std::string& msg) const {
  int pos = 0;
  if (i < static_cast<int>(toks.size())) pos = toks[i].pos;
  return Error(pos, msg);
}

ast::Pipeline Parser::Pipeline() {
  auto cmds = SplitPipeline(*this);
  bool bg = TakeBackground(*this);
  return ast::Pipeline{std::move(cmds), bg};
}

ast::Cmd Parser::Cmd() {
  ast::Cmd c;
  for (;;) {
    switch (Kind()) {
      case lex::kWord:
        c.argv.push_back(Bump().lit);
        break;
      case lex::kRedirOut:
      case lex::kRedirApp:
      case lex::kRedirIn:
      case lex::kRedirErr:
        c.redirs.push_back(ParseRedir(*this));
        break;
      default:
        if (c.argv.empty() && c.redirs.empty()) throw Errf("expected command");
        return c;
    }
  }
}

ast::Pipeline Parse(const std::vector<lex::Token>& toks) {
  Parser p{toks, 0};
  auto pl = p.Pipeline();
  if (p.Kind() != lex::kEOF) throw p.Errf(std::string("unexpected token ") + lex::KindName(p.Kind()));
  return pl;
}

}  // namespace tinysh::parse
