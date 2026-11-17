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
  auto left = Flatten(s, a, "");
  auto right = Flatten(s, b, "");
  std::set<std::string> paths;
  for (const auto& kv : left) paths.insert(kv.first);
  for (const auto& kv : right) paths.insert(kv.first);
  std::vector<Change> out;
  for (const auto& p : paths) {
    auto lit = left.find(p);
    auto rit = right.find(p);
    bool ook = lit != left.end();
    bool nok = rit != right.end();
    if (ook && !nok) out.push_back(Change{p, lit->second, kZero, "D"});
    else if (!ook && nok) out.push_back(Change{p, kZero, rit->second, "A"});
    else if (lit->second != rit->second) out.push_back(Change{p, lit->second, rit->second, "M"});
  }
  return out;
}

}  // namespace tinygit
