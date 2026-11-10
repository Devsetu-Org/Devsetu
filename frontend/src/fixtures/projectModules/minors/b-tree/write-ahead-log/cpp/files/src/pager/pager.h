#pragma once

#include "pager/page.h"

#include <mutex>
#include <string>

namespace btreekv {

// One page file. ReadPage and WritePage are safe to call from many threads;
// Allocate and Free serialize on the header state.
class Pager {
 public:
  static Pager Open(const std::string& path);
  ~Pager();

  Pager(const Pager&) = delete;
  Pager& operator=(const Pager&) = delete;
  Pager(Pager&& other) noexcept;
  Pager& operator=(Pager&& other) noexcept;

  Meta meta() const;
  void SetMeta(const Meta& m);
  PageNo Root() const { return meta().root; }
  void SetRoot(PageNo no);

  void Sync();
  void Close();

  // Student: readwrite.cc
  void WritePage(PageNo no, const uint8_t* buf, size_t len);
  void ReadPage(PageNo no, uint8_t* buf, size_t len);

  // Student: alloc.cc
  PageNo Allocate();
  void Free(PageNo no);

 private:
  explicit Pager(int fd, Meta meta);

  int fd_ = -1;
  mutable std::mutex mu_;
  Meta meta_;
};

}  // namespace btreekv
