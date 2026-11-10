#include "db/db.h"

#include "btree/tree.h"

namespace btreekv {

void ScanImpl(DB* d, std::string_view start, std::string_view end,
              const std::function<bool(std::string_view, std::string_view)>& fn) {
  Tree tree(d->store());
  PageNo no = tree.SeekLeaf(start);
  while (no != 0) {
    auto leaf = tree.ReadLeaf(no);
    size_t i = 0;
    while (i < leaf.keys.size() && leaf.keys[i] < start) ++i;
    for (; i < leaf.keys.size(); ++i) {
      if (!end.empty() && leaf.keys[i] >= end) return;
      if (!fn(leaf.keys[i], leaf.vals[i])) return;
    }
    no = leaf.next;
  }
}

}  // namespace btreekv
