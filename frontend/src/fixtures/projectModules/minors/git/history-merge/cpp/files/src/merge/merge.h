#pragma once
#include "object/hash.h"
#include "repo/repo.h"
#include <string>
#include <vector>

namespace tinygit {

inline constexpr const char* kMarkerOurs = "<<<<<<<";
inline constexpr const char* kMarkerSep = "=======";
inline constexpr const char* kMarkerTheirs = ">>>>>>>";

struct MergeResult {
  Hash commit;
  std::vector<std::string> conflicts;
  bool fast_forward = false;
};

MergeResult Merge(const Repo& r, const std::string& their_branch);

}  // namespace tinygit
