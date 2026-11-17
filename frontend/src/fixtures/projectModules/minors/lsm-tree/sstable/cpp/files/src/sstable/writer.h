#pragma once
#include <cstdio>
#include <memory>
#include <string>
#include <string_view>
#include "memtable/skiplist.h"
#include "sstable/format.h"
namespace lsmkv { namespace sstable {
struct WriterOptions { int block_size = 0; };
class Writer {
 public:
  Writer(FILE* f, std::string path, WriterOptions opts);
  ~Writer();
  Writer(const Writer&) = delete;
  Writer& operator=(const Writer&) = delete;
  Handle WriteBlock(std::string_view b);
  void Add(Kind kind, std::string_view key, std::string_view value);
  void Finish();
  void Abort();
  int Entries() const { return entries_; }
  // student-owned
  void add(Kind kind, std::string_view key, std::string_view value);
  void flushBlock();
  void finish(Handle filter);
  void noteKey(std::string_view) {}
  Handle writeFilter() { return Handle{}; }
  FILE* f_ = nullptr;
  std::string path_;
  WriterOptions opts_;
  uint64_t offset_ = 0;
  std::string block_;
  std::string index_;
  std::string last_key_;
  int entries_ = 0;
};
std::unique_ptr<Writer> Create(const std::string& path, WriterOptions opts = {});
}}  // namespace
