#include "diff/diff.h"
#include "object/tree.h"
#include <map>
#include <set>

namespace tinygit {
namespace {

std::map<std::string, Hash> Flatten(Store s, const Hash& tree, const std::string& prefix) {
  if (tree.IsZero()) return {};
  std::map<std::string, Hash> out;
  for (const auto& e : GetTree(s, tree)) {
    std::string path = prefix.empty() ? e.name : prefix + "/" + e.name;
    if (e.mode == kModeTree) {
      auto sub = Flatten(s, e.hash, path);
      out.insert(sub.begin(), sub.end());
    } else if (e.mode == kModeFile) {
      out[path] = e.hash;
    }
  }
  return out;
}

}  // namespace

std::vector<Change> TreeDiff(Store s, const Hash& a, const Hash& b) {
  // TODO(5.2): TreeDiff
  throw std::runtime_error("TODO(5.2): TreeDiff");
}

}  // namespace tinygit
