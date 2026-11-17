#include "btree/node.h"

#include <algorithm>
#include <cstring>
#include <stdexcept>

namespace btreekv {
namespace {

void PutLE16(uint8_t* p, uint16_t v) {
  p[0] = uint8_t(v);
  p[1] = uint8_t(v >> 8);
}
void PutLE32(uint8_t* p, uint32_t v) {
  p[0] = uint8_t(v);
  p[1] = uint8_t(v >> 8);
  p[2] = uint8_t(v >> 16);
  p[3] = uint8_t(v >> 24);
}
uint16_t GetLE16(const uint8_t* p) { return uint16_t(p[0]) | (uint16_t(p[1]) << 8); }
uint32_t GetLE32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

}  // namespace

int Node::CellSize(int i) const {
  if (leaf) return 4 + int(keys[i].size()) + int(vals[i].size());
  return 2 + int(keys[i].size()) + 4;
}

int Node::Size() const {
  int total = 0;
  for (size_t i = 0; i < keys.size(); ++i) total += CellSize(int(i));
  return total;
}

int Node::SplitPoint() const {
  int total = Size();
  int acc = 0;
  for (size_t i = 0; i < keys.size(); ++i) {
    int c = CellSize(int(i));
    if (leaf) {
      acc += c;
      if (acc >= total / 2) {
        return std::min(std::max(int(i) + 1, 1), int(keys.size()) - 1);
      }
      continue;
    }
    if (acc + c >= total / 2) {
      return std::min(std::max(int(i), 1), int(keys.size()) - 2);
    }
    acc += c;
  }
  return int(keys.size()) / 2;
}

void Node::InsertChild(int i, const std::string& sep, PageNo right) {
  keys.insert(keys.begin() + i, sep);
  children.insert(children.begin() + i + 1, right);
}

void Node::Encode(uint8_t* buf) const {
  if (!Fits()) throw std::runtime_error("btree: node does not fit in a page");
  std::memset(buf, 0, kPageSize);
  if (leaf) {
    buf[0] = kTypeLeaf;
    PutLE32(buf + 4, next);
  } else {
    buf[0] = kTypeInternal;
    PutLE32(buf + 4, children.back());
  }
  PutLE16(buf + 2, uint16_t(keys.size()));
  size_t off = kNodeHeaderSize;
  for (size_t i = 0; i < keys.size(); ++i) {
    PutLE16(buf + off, uint16_t(keys[i].size()));
    off += 2;
    if (leaf) {
      PutLE16(buf + off, uint16_t(vals[i].size()));
      off += 2;
    }
    std::memcpy(buf + off, keys[i].data(), keys[i].size());
    off += keys[i].size();
    if (leaf) {
      std::memcpy(buf + off, vals[i].data(), vals[i].size());
      off += vals[i].size();
    } else {
      PutLE32(buf + off, children[i]);
      off += 4;
    }
  }
}

Node Decode(const uint8_t* buf) {
  Node n;
  if (buf[0] == kTypeLeaf) {
    n.leaf = true;
    n.next = GetLE32(buf + 4);
  } else if (buf[0] == kTypeInternal) {
    n.leaf = false;
  } else {
    throw CorruptError("btree: corrupt page: bad type");
  }
  int count = GetLE16(buf + 2);
  size_t off = kNodeHeaderSize;
  auto need = [&](size_t k) {
    if (off + k > kUsable) throw CorruptError("btree: corrupt page: cell overrun");
  };
  for (int i = 0; i < count; ++i) {
    need(2);
    int kl = GetLE16(buf + off);
    off += 2;
    int vl = 0;
    if (n.leaf) {
      need(2);
      vl = GetLE16(buf + off);
      off += 2;
    }
    need(size_t(kl + vl));
    n.keys.emplace_back(reinterpret_cast<const char*>(buf + off), kl);
    off += kl;
    if (n.leaf) {
      n.vals.emplace_back(reinterpret_cast<const char*>(buf + off), vl);
      off += vl;
      continue;
    }
    need(4);
    n.children.push_back(GetLE32(buf + off));
    off += 4;
  }
  if (!n.leaf) n.children.push_back(GetLE32(buf + 4));
  return n;
}

}  // namespace btreekv
