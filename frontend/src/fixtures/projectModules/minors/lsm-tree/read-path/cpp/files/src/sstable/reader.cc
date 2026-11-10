#include "sstable/reader.h"
#include "bloom/bloom.h"
#include "sstable/iterator.h"
#include "wal/crc32c.h"
#include <stdexcept>
namespace lsmkv { namespace sstable {
Table::~Table() { Close(); }
void Table::Close() { if (f_) { fclose(f_); f_ = nullptr; } }
std::string Table::ReadBlock(Handle h) {
  if (h.offset + h.length + kTrailerSize > static_cast<uint64_t>(size_)) throw CorruptError();
  std::string buf(h.length + kTrailerSize, '\0');
  if (fseeko(f_, static_cast<off_t>(h.offset), SEEK_SET) != 0) throw std::runtime_error("seek");
  if (fread(buf.data(), 1, buf.size(), f_) != buf.size()) throw CorruptError();
  block_reads_.fetch_add(1);
  std::string_view b(buf.data(), h.length);
  uint32_t got = uint8_t(buf[h.length]) | (uint32_t(uint8_t(buf[h.length+1]))<<8) |
                 (uint32_t(uint8_t(buf[h.length+2]))<<16) | (uint32_t(uint8_t(buf[h.length+3]))<<24);
  if (wal::Checksum(b) != got) throw CorruptError();
  return std::string(b);
}
Result Table::Get(std::string_view key, std::string* value) {
  if (!mayContain(key)) return Result::kMissing;
  return get(key, value);
}
Iterator Table::NewIterator() { return Iterator(this); }
void Table::loadFilter(Handle h) {
  if (h.length == 0) return;
  filter_ = ReadBlock(h);
}
bool Table::mayContain(std::string_view key) const {
  if (filter_.empty()) return true;
  return bloom::MayContain(filter_, key);
}
std::unique_ptr<Table> Open(const std::string& path) {
  FILE* f = fopen(path.c_str(), "rb");
  if (!f) throw std::runtime_error("Open");
  Handle filter;
  std::unique_ptr<Table> t;
  try {
    t = OpenFile(f, &filter);
  } catch (...) {
    fclose(f);
    throw;
  }
  t->loadFilter(filter);
  return t;
}
}} 
