#pragma once

#include <string>
#include <string_view>
#include <vector>

namespace findx {
namespace analyze {

// Analyze turns document or query text into index tokens: split on non-letters,
// lowercase, drop stopwords.
std::vector<std::string> Analyze(std::string_view text);

// Tokenize splits text into runs of Unicode letters. Digits, punctuation, and
// whitespace separate tokens and are discarded. Case is preserved.
std::vector<std::string> Tokenize(std::string_view text);

// Lower returns a new vector with each token lowercased (Unicode).
std::vector<std::string> Lower(const std::vector<std::string>& tokens);

// FilterStop drops tokens that appear in Stopwords. Tokens must already be lowercased.
std::vector<std::string> FilterStop(const std::vector<std::string>& tokens);

}  // namespace analyze
}  // namespace findx
