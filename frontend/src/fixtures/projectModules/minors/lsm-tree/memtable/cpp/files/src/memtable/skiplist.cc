#include "memtable/skiplist.h"

#include <stdexcept>
#include <utility>

namespace lsmkv {

const char* KindName(Kind kind) {
  return kind == Kind::kTombstone ? "tombstone" : "value";
}

SkipList::SkipList(uint64_t seed) : rnd_(seed) {
  head_ = NewNode("", "", Kind::kValue, kMaxHeight);
}

Node* SkipList::NewNode(std::string key, std::string value, Kind kind, int height) {
  auto node = std::make_unique<Node>();
  node->key = std::move(key);
  node->value = std::move(value);
  node->kind = kind;
  node->next.assign(height, nullptr);
  arena_.push_back(std::move(node));
  return arena_.back().get();
}

int SkipList::RandomHeight() {
  int h = 1;
  while (h < kMaxHeight && rnd_() % kBranching == 0) {
    ++h;
  }
  return h;
}

Node* SkipList::FindGreaterOrEqual(std::string_view key, Node** prev) const {
  // ── TODO(1.1) — walk the express lanes ────────────────────────────────────
  (void)key;
  (void)prev;
  throw std::logic_error("TODO(1.1)");
}

Node* SkipList::Get(std::string_view key) const {
  Node* n = FindGreaterOrEqual(key, nullptr);
  if (n != nullptr && n->key == key) {
    return n;
  }
  return nullptr;
}

void SkipList::Put(std::string key, std::string value, Kind kind) {
  // ── TODO(1.2) — overwrite or splice ───────────────────────────────────────
  (void)key;
  (void)value;
  (void)kind;
  throw std::logic_error("TODO(1.2)");
}

}  // namespace lsmkv
