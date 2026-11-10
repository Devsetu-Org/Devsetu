#include "postings/segment.h"

#include <algorithm>
#include <cstring>
#include <fstream>
#include <stdexcept>

namespace findx {
namespace postings {
namespace {

constexpr char kMagic[4] = {'F', 'N', 'D', 'X'};
constexpr uint32_t kVersion = 1;

void AppendU32(std::vector<uint8_t>* b, uint32_t v) {
  b->push_back(static_cast<uint8_t>(v));
  b->push_back(static_cast<uint8_t>(v >> 8));
  b->push_back(static_cast<uint8_t>(v >> 16));
  b->push_back(static_cast<uint8_t>(v >> 24));
}

void AppendU16(std::vector<uint8_t>* b, uint16_t v) {
  b->push_back(static_cast<uint8_t>(v));
  b->push_back(static_cast<uint8_t>(v >> 8));
}

uint32_t ReadU32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

uint16_t ReadU16(const uint8_t* p) { return uint16_t(p[0]) | (uint16_t(p[1]) << 8); }

}  // namespace

Segment::Segment(std::unordered_map<std::string, Entry> dir, std::vector<uint8_t> data)
    : dir_(std::move(dir)), data_(std::move(data)) {}

std::pair<std::vector<Posting>, bool> Segment::Postings(const std::string& term) const {
  auto it = dir_.find(term);
  if (it == dir_.end()) return {{}, false};
  const Entry& e = it->second;
  std::vector<Posting> list;
  list.reserve(e.count);
  size_t base = e.off;
  for (uint32_t i = 0; i < e.count; ++i) {
    size_t o = base + size_t(i) * 8;
    list.push_back(Posting{ReadU32(data_.data() + o), ReadU32(data_.data() + o + 4)});
  }
  return {list, true};
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
  auto terms = m.Terms();
  std::vector<uint8_t> dir_buf;
  std::vector<uint8_t> data_buf;
  for (const auto& term : terms) {
    const auto& list = m.Postings(term);
    uint32_t off = static_cast<uint32_t>(data_buf.size());
    for (const auto& p : list) {
      AppendU32(&data_buf, p.doc_id);
      AppendU32(&data_buf, p.tf);
    }
    if (term.size() > 0xffff) throw std::runtime_error("term too long");
    AppendU16(&dir_buf, static_cast<uint16_t>(term.size()));
    dir_buf.insert(dir_buf.end(), term.begin(), term.end());
    AppendU32(&dir_buf, off);
    AppendU32(&dir_buf, static_cast<uint32_t>(list.size()));
  }
  out->clear();
  out->insert(out->end(), kMagic, kMagic + 4);
  AppendU32(out, kVersion);
  AppendU32(out, static_cast<uint32_t>(terms.size()));
  out->insert(out->end(), dir_buf.begin(), dir_buf.end());
  out->insert(out->end(), data_buf.begin(), data_buf.end());
}

void WriteSegmentToFile(const std::string& path, const Map& m) {
  std::vector<uint8_t> buf;
  WriteSegment(&buf, m);
  std::ofstream f(path, std::ios::binary);
  f.write(reinterpret_cast<const char*>(buf.data()), static_cast<std::streamsize>(buf.size()));
}

Segment DecodeSegment(const std::vector<uint8_t>& raw) {
  if (raw.size() < 12 || std::memcmp(raw.data(), kMagic, 4) != 0) {
    throw std::runtime_error("bad segment magic");
  }
  uint32_t ver = ReadU32(raw.data() + 4);
  if (ver != kVersion) throw std::runtime_error("unsupported segment version");
  uint32_t n_terms = ReadU32(raw.data() + 8);
  std::unordered_map<std::string, Entry> dir;
  size_t i = 12;
  uint32_t max_end = 0;
  for (uint32_t t = 0; t < n_terms; ++t) {
    if (i + 2 > raw.size()) throw std::runtime_error("truncated directory");
    uint16_t nlen = ReadU16(raw.data() + i);
    i += 2;
    if (i + nlen + 8 > raw.size()) throw std::runtime_error("truncated term");
    std::string name(reinterpret_cast<const char*>(raw.data() + i), nlen);
    i += nlen;
    uint32_t off = ReadU32(raw.data() + i);
    uint32_t count = ReadU32(raw.data() + i + 4);
    i += 8;
    dir[name] = Entry{off, count};
    uint32_t end = off + count * 8;
    if (end > max_end) max_end = end;
  }
  std::vector<uint8_t> data(raw.begin() + static_cast<std::ptrdiff_t>(i), raw.end());
  if (data.size() < max_end) throw std::runtime_error("truncated posting data");
  return Segment(std::move(dir), std::move(data));
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
