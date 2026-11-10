#pragma once

#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include "memtable/skiplist.h"
#include "wal/record.h"

namespace lsmkv {
namespace sstable {

constexpr size_t kFooterSize = 40;
constexpr size_t kTrailerSize = 4;
constexpr uint64_t kMagic = 0x6c736d6b76737374ull;  // "lsmkvsst"
constexpr int kDefaultBlockSize = 4096;

class CorruptError : public std::runtime_error {
 public:
  CorruptError() : std::runtime_error("sstable: corrupt table") {}
};

class OutOfOrderError : public std::runtime_error {
 public:
  OutOfOrderError() : std::runtime_error("sstable: keys must be added in strictly increasing order") {}
};

struct Handle {
  uint64_t offset = 0;
  uint64_t length = 0;
};

struct Entry {
  Kind kind = Kind::kValue;
  std::string key;
  std::string value;
};

struct IndexEntry {
  std::string last_key;
  Handle handle;
};

void AppendEntry(std::string* dst, Kind kind, std::string_view key, std::string_view value);
std::vector<Entry> DecodeBlock(std::string_view b);
void AppendIndexEntry(std::string* dst, std::string_view last_key, Handle h);
std::vector<IndexEntry> DecodeIndex(std::string_view b);
std::string EncodeFooter(Handle filter, Handle index);
void DecodeFooter(std::string_view b, Handle* filter, Handle* index);

}  // namespace sstable
}  // namespace lsmkv
