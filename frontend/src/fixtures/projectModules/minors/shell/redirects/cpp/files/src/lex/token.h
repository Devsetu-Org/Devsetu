#pragma once

#include <exception>
#include <string>

namespace tinysh::lex {

enum Kind {
  kIllegal = 0,
  kEOF,
  kWord,
  kPipe,
  kRedirOut,
  kRedirApp,
  kRedirIn,
  kRedirErr,
  kAmp,
};

const char* KindName(Kind k);

struct Token {
  Kind kind = kIllegal;
  std::string lit;
  int pos = 0;
};

struct Error : std::exception {
  int pos;
  std::string msg;
  Error(int p, std::string m) : pos(p), msg(std::move(m)) {}
  const char* what() const noexcept override { return msg.c_str(); }
};

}  // namespace tinysh::lex
