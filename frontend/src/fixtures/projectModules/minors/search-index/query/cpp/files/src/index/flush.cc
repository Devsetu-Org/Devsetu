#include "index/engine.h"

#include "postings/segment.h"

#include <cstdio>
#include <string>

namespace findx {
namespace index {

void Engine::Flush() {
  if (mem.Terms().empty()) return;
  char name[64];
  std::snprintf(name, sizeof(name), "segment-%06zu.fx", seg_names.size());
  std::string path = dir + "/" + name;
  postings::WriteSegmentToFile(path, mem);
  auto seg = postings::OpenSegment(path);
  seg_names.push_back(name);
  segs.push_back(std::move(seg));
  mem.Clear();
  buf_lens.clear();
  WriteCatalog();
}

}  // namespace index
}  // namespace findx
