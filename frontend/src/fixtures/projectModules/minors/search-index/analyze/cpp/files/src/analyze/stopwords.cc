#include "analyze/stopwords.h"

namespace findx {
namespace analyze {

const std::unordered_set<std::string>& Stopwords() {
  static const std::unordered_set<std::string> kWords = {
      "a",    "an",  "the",  "and",  "or",   "of",   "to",   "in",   "is",   "it",
      "for",  "on",  "with", "as",   "by",   "at",   "from", "be",   "this", "that",
      "are",  "was", "were", "been", "but",  "not",  "you",  "your", "we",   "they",
      "he",   "she",
  };
  return kWords;
}

}  // namespace analyze
}  // namespace findx
