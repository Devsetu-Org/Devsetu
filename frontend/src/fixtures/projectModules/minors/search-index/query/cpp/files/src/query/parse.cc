#include "query/query.h"

#include "analyze/analyze.h"

#include <sstream>
#include <stdexcept>

namespace findx {
namespace query {

Query Parse(const std::string& q) {
  // TODO(4.1): Split q on whitespace into fields. Treat a field equal to "OR"
  // as a group separator (not analyzed). Join each group's fields with spaces,
  // run analyze::Analyze, skip empty results, and return Query{groups}.
  (void)q;
  (void)analyze::Analyze;
  throw std::logic_error("TODO(4.1): Parse");
}

}  // namespace query
}  // namespace findx
