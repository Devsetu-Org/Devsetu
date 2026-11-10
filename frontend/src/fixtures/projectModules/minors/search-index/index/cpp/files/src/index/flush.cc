#include "index/engine.h"

#include "postings/segment.h"

#include <stdexcept>

namespace findx {
namespace index {

void Engine::Flush() {
  // TODO(3.2): If mem has no terms, return. Otherwise create
  // segment-%06d.fx under dir (seg_names.size() as the number), WriteSegmentToFile,
  // OpenSegment, append to seg_names / segs, Clear the map, reset buf_lens,
  // and WriteCatalog().
  (void)postings::WriteSegmentToFile;
  (void)postings::OpenSegment;
  throw std::logic_error("TODO(3.2): Engine::Flush");
}

}  // namespace index
}  // namespace findx
