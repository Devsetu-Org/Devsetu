#include "index/engine.h"

#include <stdexcept>

namespace findx {
namespace index {

Engine Open(const std::string& dir) {
  // TODO(3.3): Create the directory. Build an empty Engine.
  // If catalog.json is missing, WriteCatalog and return. Otherwise parse
  // catalog.json, restore next_doc / docs / ext_to_id, OpenSegment each name,
  // and append to seg_names / segs.
  (void)dir;
  throw std::logic_error("TODO(3.3): Open");
}

}  // namespace index
}  // namespace findx
