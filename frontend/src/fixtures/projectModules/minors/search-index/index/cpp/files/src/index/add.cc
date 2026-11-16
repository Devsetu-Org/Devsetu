#include "index/engine.h"

#include "analyze/analyze.h"

#include <stdexcept>

namespace findx {
namespace index {

void Engine::Add(const std::string& id, const std::string& text) {
  // TODO(3.1)
  (void)id;
  (void)text;
  (void)analyze::Analyze;
  throw std::logic_error("TODO(3.1)");
}

}  // namespace index
}  // namespace findx
