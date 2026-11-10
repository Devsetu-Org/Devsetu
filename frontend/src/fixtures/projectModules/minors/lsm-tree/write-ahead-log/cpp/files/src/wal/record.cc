#include "wal/record.h"

#include <cstring>

namespace lsmkv {
namespace wal {
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

void PutUint32LE(char* p, uint32_t v) {
  p[0] = static_cast<char>(v);
  p[1] = static_cast<char>(v >> 8);
  p[2] = static_cast<char>(v >> 16);
  p[3] = static_cast<char>(v >> 24);
}

}  // namespace

void AppendPayload(std::string* dst, const Record& r) {
  dst->push_back(static_cast<char>(KindToWire(r.kind)));
  AppendUvarint(dst, r.key.size());
  dst->append(r.key);
  AppendUvarint(dst, r.value.size());
  dst->append(r.value);
}

Record DecodePayload(std::string_view p) {
  if (p.empty()) throw CorruptError();
  Kind kind;
  if (!KindFromWire(static_cast<uint8_t>(p[0]), &kind)) throw CorruptError();
  size_t i = 1;
  Record r;
  r.kind = kind;
  if (!ReadBytes(p, &i, &r.key)) throw CorruptError();
  if (!ReadBytes(p, &i, &r.value) || i != p.size()) throw CorruptError();
  if (r.kind == Kind::kTombstone) r.value.clear();
  return r;
}

void Encode(std::string* dst, const Record& r) {
  // TODO(2.1): remember start = dst->size(), then append kHeaderSize zero
  // bytes as a placeholder. AppendPayload(dst, r); the payload is
  // dst->data()+start+kHeaderSize .. end. Write Checksum(payload) into the
  // first 4 bytes and payload length into the next 4, both little-endian.
  // Append to *dst; never overwrite what is already in it.
  (void)dst;
  (void)r;
  throw std::logic_error("TODO(2.1): Encode");
}

}  // namespace wal
}  // namespace lsmkv
