#include "merge/base.h"
#include "object/commit.h"
#include <queue>
#include <unordered_set>

namespace tinygit {

Hash MergeBase(Store s, const Hash& a, const Hash& b) {
  std::unordered_set<Hash> ancestors;
  std::queue<Hash> q;
  q.push(a);
  while (!q.empty()) {
    Hash cur = q.front(); q.pop();
    if (ancestors.count(cur) || cur.IsZero()) continue;
    ancestors.insert(cur);
    Commit c = GetCommit(s, cur);
    for (const auto& p : c.parents) q.push(p);
  }
  q.push(b);
  std::unordered_set<Hash> seen;
  while (!q.empty()) {
    Hash cur = q.front(); q.pop();
    if (seen.count(cur) || cur.IsZero()) continue;
    seen.insert(cur);
    if (ancestors.count(cur)) return cur;
    Commit c = GetCommit(s, cur);
    for (const auto& p : c.parents) q.push(p);
  }
  return kZero;
}

}  // namespace tinygit
