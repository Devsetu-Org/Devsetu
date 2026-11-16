#include "postings/segment.h"

#include <algorithm>
#include <fstream>
#include <stdexcept>

namespace findx {
namespace postings {

Segment::Segment(std::unordered_map<std::string, Entry> dir, std::vector<uint8_t> data)
    : dir_(std::move(dir)), data_(std::move(data)) {}

std::pair<std::vector<Posting>, bool> Segment::Postings(const std::string& term) const {
  // TODO(2.3)
  (void)term;
  throw std::logic_error("TODO(2.3)");
}

std::vector<std::string> Segment::Terms() const {
  std::vector<std::string> out;
  out.reserve(dir_.size());
  for (const auto& kv : dir_) out.push_back(kv.first);
  std::sort(out.begin(), out.end());
  return out;
}

int Segment::DF(const std::string& term) const {
  auto it = dir_.find(term);
  if (it == dir_.end()) return 0;
  return static_cast<int>(it->second.count);
}

void WriteSegment(std::vector<uint8_t>* out, const Map& m) {
  // TODO(2.2)
  (void)out;
  (void)m;
  throw std::logic_error("TODO(2.2)");
}

void WriteSegmentToFile(const std::string& path, const Map& m) {
  std::vector<uint8_t> buf;
  WriteSegment(&buf, m);
  std::ofstream f(path, std::ios::binary);
  f.write(reinterpret_cast<const char*>(buf.data()), static_cast<std::streamsize>(buf.size()));
}

Segment DecodeSegment(const std::vector<uint8_t>& raw) {
  // TODO(2.3)
  (void)raw;
  throw std::logic_error("TODO(2.3)");
}

Segment OpenSegment(const std::string& path) {
  std::ifstream f(path, std::ios::binary);
  if (!f) throw std::runtime_error("open segment: " + path);
  f.seekg(0, std::ios::end);
  auto n = f.tellg();
  f.seekg(0, std::ios::beg);
  std::vector<uint8_t> raw(static_cast<size_t>(n));
  f.read(reinterpret_cast<char*>(raw.data()), n);
  return DecodeSegment(raw);
}

}  // namespace postings
}  // namespace findx
