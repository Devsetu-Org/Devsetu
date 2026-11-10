#pragma once

#include "pager/page.h"

#include <cstdint>
#include <string>
#include <string_view>
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
  bool Underfull() const { return Size() < int(kCapacity / 4); }
  void RemoveLeafAt(int i);
  void RemoveChild(int i);
  void Encode(uint8_t* buf) const;
};

bool CanMerge(const Node& left, const Node& right, std::string_view sep);
void MergeNodes(Node* left, const Node& right, std::string_view sep);
std::string Redistribute(Node* left, Node* right, std::string_view sep);


Node Decode(const uint8_t* buf);

}  // namespace btreekv
