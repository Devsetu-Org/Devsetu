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
  // TODO(1.1): Walk UTF-8 code points with NextCodepoint. Append a token whenever
  // a run of IsLetter ends. Do not keep digits or punctuation. Case is preserved.
  (void)text;
  (void)NextCodepoint;
  (void)IsLetter;
  throw std::logic_error("TODO(1.1): Tokenize");
}

std::vector<std::string> Lower(const std::vector<std::string>& tokens) {
  // TODO(1.2): Allocate an output vector the same size. ToLowerUtf8 each token.
  (void)tokens;
  (void)ToLowerUtf8;
  throw std::logic_error("TODO(1.2): Lower");
}

std::vector<std::string> FilterStop(const std::vector<std::string>& tokens) {
  // TODO(1.3): Keep tokens that are not in Stopwords(). Preserve order.
  (void)tokens;
  (void)Stopwords;
  throw std::logic_error("TODO(1.3): FilterStop");
}

}  // namespace analyze
}  // namespace findx
