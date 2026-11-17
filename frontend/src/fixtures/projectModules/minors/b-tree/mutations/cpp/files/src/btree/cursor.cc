#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

PageNo Tree::SeekLeaf(std::string_view key) {
  return FindLeaf(key, nullptr);
}

Tree::LeafView Tree::ReadLeaf(PageNo no) {
  Node n = Load(no);
  if (!n.leaf) throw CorruptError("btree: page is not a leaf");
  LeafView v;
  v.keys = n.keys;
  v.vals = n.vals;
  v.next = n.next;
  return v;
}

}  // namespace btreekv
