#pragma once

#include "postings/map.h"
#include "postings/posting.h"

#include <cstdint>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace findx {
namespace postings {

struct Entry {
  uint32_t off = 0;
  uint32_t count = 0;
};

// Segment is a read-only on-disk posting dictionary for one flush.
class Segment {
 public:
  Segment() = default;
  Segment(std::unordered_map<std::string, Entry> dir, std::vector<uint8_t> data);

  // Postings looks up term. ok is false when the term is absent.
  std::pair<std::vector<Posting>, bool> Postings(const std::string& term) const;

  std::vector<std::string> Terms() const;
  int DF(const std::string& term) const;

 private:
  std::unordered_map<std::string, Entry> dir_;
  std::vector<uint8_t> data_;
};

// WriteSegment encodes m as a segment into out. Terms are stored sorted.
//
// Layout (little-endian):
//   magic "FNDX" (4) | version u32 | nTerms u32
//   directory: for each term (sorted): nameLen u16 | name | dataOff u32 | count u32
//   data: for each term in directory order: count × (docId u32 | tf u32)
void WriteSegment(std::vector<uint8_t>* out, const Map& m);
void WriteSegmentToFile(const std::string& path, const Map& m);

Segment DecodeSegment(const std::vector<uint8_t>& raw);
Segment OpenSegment(const std::string& path);

}  // namespace postings
}  // namespace findx
