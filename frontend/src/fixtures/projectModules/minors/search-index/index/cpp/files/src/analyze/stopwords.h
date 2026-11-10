#pragma once

#include <string>
#include <unordered_set>

namespace findx {
namespace analyze {

// Stopwords are dropped after lowercasing. Fixed for the minor.
const std::unordered_set<std::string>& Stopwords();

}  // namespace analyze
}  // namespace findx
