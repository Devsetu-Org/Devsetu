#pragma once
#include <string>
#include <string_view>
#include <vector>
#include "memtable/skiplist.h"
#include "sstable/format.h"
namespace lsmkv { namespace sstable {
class Table;
class Iterator {
 public:
  explicit Iterator(Table* t);
  void SeekToFirst();
  void Seek(std::string_view target);
  bool Valid() const;
  void Next();
  std::string_view Key() const;
  std::string_view Value() const;
  Kind kind() const;
  const char* Err() const { return err_.empty() ? nullptr : err_.c_str(); }
 private:
  void load(int i);
  void skipExhausted();
  Table* t_;
  int block_ = 0;
  std::vector<Entry> entries_;
  int pos_ = 0;
  std::string err_;
};
}} 
