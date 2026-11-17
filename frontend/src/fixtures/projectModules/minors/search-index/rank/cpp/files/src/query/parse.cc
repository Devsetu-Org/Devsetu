#include "query/query.h"

#include "analyze/analyze.h"

#include <sstream>

namespace findx {
namespace query {
namespace {

std::vector<std::string> SplitOR(const std::string& q) {
  std::istringstream in(q);
  std::string field;
  std::vector<std::string> parts;
  std::vector<std::string> cur;
  auto flush = [&]() {
    if (cur.empty()) return;
    std::ostringstream joined;
    for (size_t i = 0; i < cur.size(); ++i) {
      if (i) joined << ' ';
      joined << cur[i];
    }
    parts.push_back(joined.str());
    cur.clear();
  };
  while (in >> field) {
    if (field == "OR") {
      flush();
      continue;
    }
    cur.push_back(field);
  }
  flush();
  return parts;
}

}  // namespace

Query Parse(const std::string& q) {
  Query out;
  for (const auto& part : SplitOR(q)) {
    auto terms = analyze::Analyze(part);
    if (terms.empty()) continue;
    out.groups.push_back(std::move(terms));
  }
  return out;
}

}  // namespace query
}  // namespace findx
