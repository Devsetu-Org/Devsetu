#pragma once

#include "postings/map.h"
#include "postings/segment.h"

#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace findx {
namespace index {

struct Meta {
  std::string ext_id;
  int length = 0;
};

class Engine {
 public:
  std::string dir;
  uint32_t next_doc = 0;
  std::unordered_map<uint32_t, Meta> docs;
  std::unordered_map<std::string, uint32_t> ext_to_id;
  postings::Map mem;
  std::unordered_map<uint32_t, int> buf_lens;
  std::vector<std::string> seg_names;
  std::vector<postings::Segment> segs;

  void Add(const std::string& id, const std::string& text);
  void Flush();

  void WriteCatalog() const;

  std::vector<postings::Posting> Postings(const std::string& term) const;
  bool Doc(uint32_t id, Meta* out) const;
  int NumDocs() const;
  double AvgDL() const;
  int DF(const std::string& term) const;
  std::string ExtID(uint32_t id) const;
};

// Open loads an index from dir, creating the directory and an empty catalog when missing.
Engine Open(const std::string& dir);

}  // namespace index
}  // namespace findx
