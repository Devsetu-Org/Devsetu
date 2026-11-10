#pragma once
#include <atomic>
#include <cstdio>
#include <memory>
#include <string>
#include <string_view>
#include <vector>
#include "memtable/memtable.h"
#include "sstable/format.h"
namespace lsmkv { namespace sstable {
class Iterator;
class Table {
 public:
  ~Table();
  Result Get(std::string_view key, std::string* value);
  int NumBlocks() const { return static_cast<int>(index_.size()); }
  int64_t BlockReads() const { return block_reads_.load(); }
  void Close();
  Iterator NewIterator();
  void loadFilter(Handle) {}
  bool mayContain(std::string_view) const { return true; }
  std::string ReadBlock(Handle h);
  // student
  Result get(std::string_view key, std::string* value);
  FILE* f_ = nullptr;
  int64_t size_ = 0;
  std::vector<IndexEntry> index_;
  std::atomic<int64_t> block_reads_{0};
};
std::unique_ptr<Table> Open(const std::string& path);
std::unique_ptr<Table> OpenFile(FILE* f, Handle* filter_out);  // student open
}} 
