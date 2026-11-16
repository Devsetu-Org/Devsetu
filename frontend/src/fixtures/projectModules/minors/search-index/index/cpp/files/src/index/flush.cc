#include "index/engine.h"

#include "postings/segment.h"

#include <stdexcept>

namespace findx {
namespace index {

void Engine::Flush() {
  // TODO(3.2)
  (void)postings::WriteSegmentToFile;
  (void)postings::OpenSegment;
  throw std::logic_error("TODO(3.2)");
}

}  // namespace index
}  // namespace findx
