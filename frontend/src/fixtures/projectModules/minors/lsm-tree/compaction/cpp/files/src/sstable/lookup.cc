#include "sstable/reader.h"
#include <algorithm>
namespace lsmkv { namespace sstable {
std::unique_ptr<Table> OpenFile(FILE* f, Handle* filter_out) {
  if (fseeko(f, 0, SEEK_END) != 0) throw std::runtime_error("stat");
  int64_t size = ftello(f);
  if (size < static_cast<int64_t>(kFooterSize)) throw CorruptError();
  auto t = std::make_unique<Table>();
  t->f_ = f;
  t->size_ = size;
  std::string footer(kFooterSize, '\0');
  if (fseeko(f, size - static_cast<int64_t>(kFooterSize), SEEK_SET) != 0) throw std::runtime_error("seek");
  if (fread(footer.data(), 1, kFooterSize, f) != kFooterSize) throw CorruptError();
  Handle filter, index_h;
  DecodeFooter(footer, &filter, &index_h);
  std::string raw = t->ReadBlock(index_h);
  t->index_ = DecodeIndex(raw);
  *filter_out = filter;
  return t;
}
Result Table::get(std::string_view key, std::string* value) {
  auto it = std::lower_bound(index_.begin(), index_.end(), key,
      [](const IndexEntry& e, std::string_view k) { return e.last_key < k; });
  if (it == index_.end()) return Result::kMissing;
  std::string raw = ReadBlock(it->handle);
  auto entries = DecodeBlock(raw);
  for (const auto& e : entries) {
    int c = e.key.compare(0, e.key.size(), key.data(), key.size());
    if (c == 0) {
      if (e.kind == Kind::kTombstone) return Result::kDeleted;
      *value = e.value;
      return Result::kFound;
    }
    if (c > 0) return Result::kMissing;
  }
  return Result::kMissing;
}
}} 
