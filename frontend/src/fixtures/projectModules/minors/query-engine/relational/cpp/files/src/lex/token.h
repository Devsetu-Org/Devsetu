#pragma once

#include <stdexcept>
#include <string>

namespace sqlq {
namespace lex {

enum class Kind {
  kIllegal,
  kEof,
  kIdent,
  kInt,
  kString,
  kStar,
  kComma,
  kLParen,
  kRParen,
  kEq,
  kLt,
  kGt,
  kSemicolon,
  kDot,
  kKwSelect,
  kKwFrom,
  kKwWhere,
  kKwCreate,
  kKwTable,
  kKwInsert,
  kKwInto,
  kKwValues,
  kKwInt,
  kKwText,
  kKwAnd,
  kKwJoin,
  kKwInner,
  kKwOn,
  kKwGroup,
  kKwBy,
  kKwOrder,
  kKwLimit,
  kKwAsc,
  kKwDesc,
  kKwCount,
  kKwSum,
  kKwAs,
};

const char* KindName(Kind k);

struct Token {
  Kind kind = Kind::kIllegal;
  std::string lit;
  int pos = 0;
};

struct Error : public std::runtime_error {
  int pos;
  explicit Error(int p, const std::string& msg) : std::runtime_error(msg), pos(p) {}
};

Kind Keyword(const std::string& lit);

}  // namespace lex
}  // namespace sqlq
