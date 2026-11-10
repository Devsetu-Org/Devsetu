#pragma once

#include "btree/tree.h"

#include <cstring>

#include <stdexcept>
#include <unordered_map>
#include <vector>

namespace btreekv {

class MemIO : public PageIO {
 public:
  MemIO() = default;
  void ReadPage(PageNo no, uint8_t* buf, size_t len) override {
    auto it = pages_.find(no);
    if (it == pages_.end()) throw std::runtime_error("memIO: read of unallocated page");
    ++reads;
    std::memcpy(buf, it->second.data(), len);
  }
  void WritePage(PageNo no, const uint8_t* buf, size_t len) override {
    auto it = pages_.find(no);
    if (it == pages_.end()) throw std::runtime_error("memIO: write to unallocated page");
    ++writes;
    it->second.assign(buf, buf + len);
  }
  PageNo Allocate() override {
    PageNo no;
    if (!free_.empty()) {
      no = free_.back();
      free_.pop_back();
    } else {
      no = next_++;
    }
    pages_[no] = std::vector<uint8_t>(kPageSize, 0);
    return no;
  }
  void Free(PageNo no) override {
    if (!pages_.count(no)) throw std::runtime_error("memIO: free of unallocated page");
    pages_.erase(no);
    free_.push_back(no);
  }
  PageNo Root() const override { return root_; }
  void SetRoot(PageNo no) override { root_ = no; }

  int reads = 0;
  int writes = 0;

 private:
  std::unordered_map<PageNo, std::vector<uint8_t>> pages_;
  std::vector<PageNo> free_;
  PageNo next_ = 1;
  PageNo root_ = 0;
};

}  // namespace btreekv
