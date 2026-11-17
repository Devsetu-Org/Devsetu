#include "analyze/analyze.h"

#include "analyze/letters.h"
#include "analyze/stopwords.h"

#include <stdexcept>

namespace findx {
namespace analyze {

std::vector<std::string> Analyze(std::string_view text) {
  return FilterStop(Lower(Tokenize(text)));
}

std::vector<std::string> Tokenize(std::string_view text) {
  // TODO(1.1)
  (void)text;
  (void)NextCodepoint;
  (void)IsLetter;
  throw std::logic_error("TODO(1.1)");
}

std::vector<std::string> Lower(const std::vector<std::string>& tokens) {
  // TODO(1.2)
  (void)tokens;
  (void)ToLowerUtf8;
  throw std::logic_error("TODO(1.2)");
}

std::vector<std::string> FilterStop(const std::vector<std::string>& tokens) {
  // TODO(1.3)
  (void)tokens;
  (void)Stopwords;
  throw std::logic_error("TODO(1.3)");
}

}  // namespace analyze
}  // namespace findx
