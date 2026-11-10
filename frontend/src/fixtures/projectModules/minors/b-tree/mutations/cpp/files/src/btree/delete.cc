#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

std::pair<bool, bool> Tree::DeleteRec(PageNo no, std::string_view key) {
  // TODO(5.1): Load node. Leaf: LeafIndex; miss -> false,false. Hit: RemoveLeafAt,
  // Store, return true, Underfull(). Internal: ChildIndex, recurse. If !found or
  // !child_under return as-is. Else Rebalance and return true, Underfull().
  (void)no;
  (void)key;
  throw std::logic_error("TODO(5.1): DeleteRec");
}

void Tree::Rebalance(PageNo parent_no, Node& parent, int i) {
  // TODO(5.2): Pair with left sibling if i>0 else right. canMerge -> MergeNodes,
  // Free right, RemoveChild. Else Redistribute and store both. Store parent.
  (void)parent_no;
  (void)parent;
  (void)i;
  throw std::logic_error("TODO(5.2): Rebalance");
}

bool Tree::Delete(std::string_view key) {
  // TODO(5.3): Empty root or empty key -> false. DeleteRec. Shrink empty root.
  (void)key;
  throw std::logic_error("TODO(5.3): Delete");
}

}  // namespace btreekv
