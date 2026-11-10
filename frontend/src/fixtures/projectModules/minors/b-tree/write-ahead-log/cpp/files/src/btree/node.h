#pragma once

#include "pager/page.h"

#include <cstdint>
#include <string>
#include <vector>

namespace btreekv {

constexpr size_t kMaxKeySize = 128;
constexpr size_t kMaxValueSize = 1024;
constexpr int kMaxDepth = 64;

constexpr uint8_t kTypeLeaf = 1;
constexpr uint8_t kTypeInternal = 2;
constexpr size_t kNodeHeaderSize = 8;
constexpr size_t kCapacity = kUsable - kNodeHeaderSize;

struct Node {
  bool leaf = false;
  std::vector<std::string> keys;
  std::vector<std::string> vals;     // leaf
  std::vector<PageNo> children;      // internal
  PageNo next = 0;                   // leaf

  int CellSize(int i) const;
  int Size() const;
  bool Fits() const { return Size() <= static_cast<int>(kCapacity); }
  int SplitPoint() const;
  void InsertChild(int i, const std::string& sep, PageNo right);
  void Encode(uint8_t* buf) const;
};

Node Decode(const uint8_t* buf);

}  // namespace btreekv
