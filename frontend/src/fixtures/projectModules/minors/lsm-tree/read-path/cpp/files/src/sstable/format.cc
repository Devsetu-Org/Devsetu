#include "sstable/format.h"

#include "wal/record.h"

namespace lsmkv {
namespace sstable {
namespace {

void AppendUvarint(std::string* dst, uint64_t n) {
  while (n >= 0x80) {
    dst->push_back(static_cast<char>((n & 0x7F) | 0x80));
    n >>= 7;
  }
  dst->push_back(static_cast<char>(n));
}

bool ReadUvarint(std::string_view p, size_t* i, uint64_t* out) {
  uint64_t result = 0;
  int shift = 0;
  while (*i < p.size()) {
    uint8_t b = static_cast<uint8_t>(p[(*i)++]);
    result |= static_cast<uint64_t>(b & 0x7F) << shift;
    if (b < 0x80) {
      *out = result;
      return true;
    }
    shift += 7;
    if (shift >= 64) return false;
  }
  return false;
}

bool ReadBytes(std::string_view p, size_t* i, std::string* out) {
  uint64_t n = 0;
  if (!ReadUvarint(p, i, &n)) return false;
  if (n > p.size() - *i) return false;
  out->assign(p.data() + *i, static_cast<size_t>(n));
  *i += static_cast<size_t>(n);
  return true;
}

void PutU64LE(char* p, uint64_t v) {
  for (int i = 0; i < 8; ++i) p[i] = static_cast<char>((v >> (8 * i)) & 0xff);
}

uint64_t ReadU64LE(const char* p) {
  uint64_t v = 0;
  for (int i = 0; i < 8; ++i) v |= uint64_t(uint8_t(p[i])) << (8 * i);
  return v;
}

}  // namespace

void AppendEntry(std::string* dst, Kind kind, std::string_view key, std::string_view value) {
  dst->push_back(static_cast<char>(wal::KindToWire(kind)));
  AppendUvarint(dst, key.size());
  dst->append(key.data(), key.size());
  AppendUvarint(dst, value.size());
  dst->append(value.data(), value.size());
}

std::vector<Entry> DecodeBlock(std::string_view b) {
  std::vector<Entry> out;
  size_t i = 0;
  while (i < b.size()) {
    Kind kind;
    if (!wal::KindFromWire(static_cast<uint8_t>(b[i]), &kind)) throw CorruptError();
    ++i;
    Entry e;
    e.kind = kind;
    if (!ReadBytes(b, &i, &e.key) || !ReadBytes(b, &i, &e.value)) throw CorruptError();
    if (e.kind == Kind::kTombstone) e.value.clear();
    out.push_back(std::move(e));
  }
  return out;
}

void AppendIndexEntry(std::string* dst, std::string_view last_key, Handle h) {
  AppendUvarint(dst, last_key.size());
  dst->append(last_key.data(), last_key.size());
  AppendUvarint(dst, h.offset);
  AppendUvarint(dst, h.length);
}

std::vector<IndexEntry> DecodeIndex(std::string_view b) {
  std::vector<IndexEntry> out;
  size_t i = 0;
  while (i < b.size()) {
    IndexEntry e;
    if (!ReadBytes(b, &i, &e.last_key)) throw CorruptError();
    uint64_t off = 0, len = 0;
    if (!ReadUvarint(b, &i, &off) || !ReadUvarint(b, &i, &len)) throw CorruptError();
    e.handle = Handle{off, len};
    out.push_back(std::move(e));
  }
  return out;
}

std::string EncodeFooter(Handle filter, Handle index) {
  std::string b(kFooterSize, '\0');
  PutU64LE(&b[0], filter.offset);
  PutU64LE(&b[8], filter.length);
  PutU64LE(&b[16], index.offset);
  PutU64LE(&b[24], index.length);
  PutU64LE(&b[32], kMagic);
  return b;
}

void DecodeFooter(std::string_view b, Handle* filter, Handle* index) {
  if (b.size() != kFooterSize || ReadU64LE(b.data() + 32) != kMagic) throw CorruptError();
  *filter = Handle{ReadU64LE(b.data()), ReadU64LE(b.data() + 8)};
  *index = Handle{ReadU64LE(b.data() + 16), ReadU64LE(b.data() + 24)};
}

}  // namespace sstable
}  // namespace lsmkv
