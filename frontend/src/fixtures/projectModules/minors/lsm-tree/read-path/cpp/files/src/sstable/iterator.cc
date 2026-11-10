#include "sstable/iterator.h"
#include "sstable/reader.h"
#include <algorithm>
namespace lsmkv { namespace sstable {
Iterator::Iterator(Table* t) : t_(t), block_(static_cast<int>(t->index_.size())) {}
void Iterator::SeekToFirst() { load(0); skipExhausted(); }
void Iterator::Seek(std::string_view target) {
  auto it = std::lower_bound(t_->index_.begin(), t_->index_.end(), target,
      [](const IndexEntry& e, std::string_view k) { return e.last_key < k; });
  int i = static_cast<int>(it - t_->index_.begin());
  load(i);
  while (pos_ < static_cast<int>(entries_.size()) && entries_[pos_].key < target) ++pos_;
  skipExhausted();
}
bool Iterator::Valid() const { return pos_ < static_cast<int>(entries_.size()); }
void Iterator::Next() { ++pos_; skipExhausted(); }
std::string_view Iterator::Key() const { return entries_[pos_].key; }
std::string_view Iterator::Value() const { return entries_[pos_].value; }
Kind Iterator::kind() const { return entries_[pos_].kind; }
void Iterator::load(int i) {
  block_ = i; entries_.clear(); pos_ = 0;
  if (!err_.empty() || i >= static_cast<int>(t_->index_.size())) {
    block_ = static_cast<int>(t_->index_.size());
    return;
  }
  try {
    std::string raw = t_->ReadBlock(t_->index_[i].handle);
    entries_ = DecodeBlock(raw);
  } catch (const std::exception& e) {
    err_ = e.what();
    entries_.clear();
    block_ = static_cast<int>(t_->index_.size());
  }
}
void Iterator::skipExhausted() {
  while (pos_ >= static_cast<int>(entries_.size()) && block_ < static_cast<int>(t_->index_.size())) {
    load(block_ + 1);
  }
}
}} 
