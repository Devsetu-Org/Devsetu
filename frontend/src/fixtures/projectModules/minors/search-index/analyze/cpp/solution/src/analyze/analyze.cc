#include "analyze/analyze.h"

#include "analyze/letters.h"
#include "analyze/stopwords.h"

namespace findx {
namespace analyze {

std::vector<std::string> Analyze(std::string_view text) {
  return FilterStop(Lower(Tokenize(text)));
}

std::vector<std::string> Tokenize(std::string_view text) {
  std::vector<std::string> out;
  std::string buf;
  const char* p = text.data();
  const char* end = text.data() + text.size();
  auto flush = [&]() {
    if (!buf.empty()) {
      out.push_back(buf);
      buf.clear();
    }
  };
  while (p < end) {
    const char* start = p;
    char32_t cp = 0;
    if (!NextCodepoint(&p, end, &cp)) break;
    if (IsLetter(cp)) {
      buf.append(start, p - start);
      continue;
    }
    flush();
  }
  flush();
  return out;
}

std::vector<std::string> Lower(const std::vector<std::string>& tokens) {
  std::vector<std::string> out;
  out.reserve(tokens.size());
  for (const auto& t : tokens) out.push_back(ToLowerUtf8(t));
  return out;
}

std::vector<std::string> FilterStop(const std::vector<std::string>& tokens) {
  std::vector<std::string> out;
  const auto& sw = Stopwords();
  for (const auto& t : tokens) {
    if (sw.count(t)) continue;
    out.push_back(t);
  }
  return out;
}

}  // namespace analyze
}  // namespace findx
