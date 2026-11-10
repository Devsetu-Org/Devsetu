#include "diff/log.h"
#include <unordered_set>

namespace tinygit {

std::pair<std::vector<Commit>, std::vector<Hash>> LogWalk(Store s, const Hash& tip) {
  std::vector<Commit> commits;
  std::vector<Hash> hashes;
  std::unordered_set<Hash> seen;
  Hash cur = tip;
  while (!cur.IsZero()) {
    if (seen.count(cur)) break;
    seen.insert(cur);
    Commit c = GetCommit(s, cur);
    commits.push_back(c);
    hashes.push_back(cur);
    if (c.parents.empty()) break;
    cur = c.parents[0];
  }
  return {commits, hashes};
}

}  // namespace tinygit
