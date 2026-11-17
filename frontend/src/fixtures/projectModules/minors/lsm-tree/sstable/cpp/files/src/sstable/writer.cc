#include "sstable/writer.h"
#include "wal/crc32c.h"
#include <stdexcept>
namespace lsmkv { namespace sstable {
Writer::Writer(FILE* f, std::string path, WriterOptions opts)
    : f_(f), path_(std::move(path)), opts_(opts) {
  if (opts_.block_size <= 0) opts_.block_size = kDefaultBlockSize;
}
Writer::~Writer() { if (f_) { fclose(f_); f_ = nullptr; } }
Handle Writer::WriteBlock(std::string_view b) {
  Handle h{offset_, static_cast<uint64_t>(b.size())};
  uint32_t sum = wal::Checksum(b);
  char trailer[kTrailerSize] = {
      char(sum), char(sum >> 8), char(sum >> 16), char(sum >> 24)};
  if (fwrite(b.data(), 1, b.size(), f_) != b.size()) throw std::runtime_error("write");
  if (fwrite(trailer, 1, kTrailerSize, f_) != kTrailerSize) throw std::runtime_error("write");
  offset_ += b.size() + kTrailerSize;
  return h;
}
void Writer::Add(Kind kind, std::string_view key, std::string_view value) {
  add(kind, key, value);
  noteKey(key);
}
void Writer::Finish() {
  flushBlock();
  finish(writeFilter());
}
void Writer::Abort() {
  if (f_) { fclose(f_); f_ = nullptr; }
  ::remove(path_.c_str());
}
std::unique_ptr<Writer> Create(const std::string& path, WriterOptions opts) {
  FILE* f = fopen(path.c_str(), "wb");
  if (!f) throw std::runtime_error("Create");
  return std::make_unique<Writer>(f, path, opts);
}
}}  // namespace
