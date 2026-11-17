#include "query/query.h"

#include "analyze/analyze.h"

#include <sstream>
#include <stdexcept>

namespace findx {
namespace query {

Query Parse(const std::string& q) {
  // TODO(4.1)
  (void)q;
  (void)analyze::Analyze;
  throw std::logic_error("TODO(4.1)");
}

}  // namespace query
}  // namespace findx
