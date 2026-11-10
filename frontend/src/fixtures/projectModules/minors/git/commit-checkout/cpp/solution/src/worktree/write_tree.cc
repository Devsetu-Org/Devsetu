#include "worktree/write_tree.h"
#include "index/codec.h"
#include "object/tree.h"
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <variant>
#include <vector>

namespace tinygit {
namespace {

struct Node;
using NodeMap = std::map<std::string, std::shared_ptr<Node>>;
struct Node {
  bool is_file = false;
  IndexEntry file;
  NodeMap kids;
};

Hash WriteNode(Store s, const NodeMap& node) {
  std::vector<TreeEntry> entries;
  for (const auto& kv : node) {
    if (kv.second->is_file) {
      entries.push_back(TreeEntry{kv.second->file.mode, kv.first, kv.second->file.hash});
    } else {
      Hash h = WriteNode(s, kv.second->kids);
      entries.push_back(TreeEntry{kModeTree, kv.first, h});
    }
  }
  return PutTree(s, entries);
}

}  // namespace

Hash WriteTree(const Repo& r) {
  Index idx = LoadIndex(r.IndexPath());
  Store s = r.Objects();
  if (idx.entries.empty()) return PutTree(s, {});
  NodeMap root;
  for (const auto& e : idx.entries) {
    std::stringstream ss(e.path);
    std::string part;
    std::vector<std::string> parts;
    while (std::getline(ss, part, '/')) parts.push_back(part);
    NodeMap* cur = &root;
    for (size_t i = 0; i < parts.size(); ++i) {
      auto& slot = (*cur)[parts[i]];
      if (!slot) slot = std::make_shared<Node>();
      if (i == parts.size() - 1) {
        slot->is_file = true;
        slot->file = e;
      } else {
        if (slot->is_file) throw std::runtime_error("worktree: path conflict");
        cur = &slot->kids;
      }
    }
  }
  return WriteNode(s, root);
}

}  // namespace tinygit
