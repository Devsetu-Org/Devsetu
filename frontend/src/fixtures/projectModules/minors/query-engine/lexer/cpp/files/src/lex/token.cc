#include "lex/token.h"

#include <cctype>
#include <string>
#include <unordered_map>

namespace sqlq {
namespace lex {

namespace {
const char* kNames[] = {
    "illegal", "eof", "ident", "int", "string",
    "star", "comma", "lparen", "rparen", "eq", "lt", "gt", "semicolon", "dot",
    "select", "from", "where", "create", "table", "insert", "into", "values",
    "intkw", "text", "and", "join", "inner", "on", "group", "by", "order",
    "limit", "asc", "desc", "count", "sum", "as",
};
}

const char* KindName(Kind k) {
  auto i = static_cast<int>(k);
  if (i >= 0 && i < static_cast<int>(sizeof(kNames) / sizeof(kNames[0]))) return kNames[i];
  return "illegal";
}

Kind Keyword(const std::string& lit) {
  static const std::unordered_map<std::string, Kind> kws = {
      {"select", Kind::kKwSelect}, {"from", Kind::kKwFrom},   {"where", Kind::kKwWhere},
      {"create", Kind::kKwCreate}, {"table", Kind::kKwTable}, {"insert", Kind::kKwInsert},
      {"into", Kind::kKwInto},     {"values", Kind::kKwValues}, {"int", Kind::kKwInt},
      {"text", Kind::kKwText},     {"and", Kind::kKwAnd},     {"join", Kind::kKwJoin},
      {"inner", Kind::kKwInner},   {"on", Kind::kKwOn},       {"group", Kind::kKwGroup},
      {"by", Kind::kKwBy},         {"order", Kind::kKwOrder}, {"limit", Kind::kKwLimit},
      {"asc", Kind::kKwAsc},       {"desc", Kind::kKwDesc},   {"count", Kind::kKwCount},
      {"sum", Kind::kKwSum},       {"as", Kind::kKwAs},
  };
  std::string lower;
  lower.reserve(lit.size());
  for (char c : lit) lower.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
  auto it = kws.find(lower);
  return it == kws.end() ? Kind::kIdent : it->second;
}

}  // namespace lex
}  // namespace sqlq
