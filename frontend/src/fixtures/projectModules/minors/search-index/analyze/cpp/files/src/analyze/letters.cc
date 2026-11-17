#include "analyze/letters.h"

#include <cctype>

namespace findx {
namespace analyze {

bool NextCodepoint(const char** p, const char* end, char32_t* out) {
  if (*p >= end) return false;
  unsigned char c = static_cast<unsigned char>(**p);
  if (c < 0x80) {
    *out = c;
    ++(*p);
    return true;
  }
  int need = 0;
  char32_t cp = 0;
  if ((c & 0xE0) == 0xC0) {
    need = 1;
    cp = c & 0x1F;
  } else if ((c & 0xF0) == 0xE0) {
    need = 2;
    cp = c & 0x0F;
  } else if ((c & 0xF8) == 0xF0) {
    need = 3;
    cp = c & 0x07;
  } else {
    *out = c;
    ++(*p);
    return true;
  }
  ++(*p);
  for (int i = 0; i < need; ++i) {
    if (*p >= end) return false;
    unsigned char cc = static_cast<unsigned char>(**p);
    if ((cc & 0xC0) != 0x80) return false;
    cp = (cp << 6) | (cc & 0x3F);
    ++(*p);
  }
  *out = cp;
  return true;
}

bool IsLetter(char32_t cp) {
  if (cp <= 0x7F) {
    return (cp >= 'A' && cp <= 'Z') || (cp >= 'a' && cp <= 'z');
  }
  // Latin-1 supplement letters
  if (cp >= 0x00C0 && cp <= 0x00FF && cp != 0x00D7 && cp != 0x00F7) return true;
  // Treat other non-ASCII non-digit BMP code points as letters for this minor.
  if (cp >= 0x100 && cp < 0xFFFE) {
    if (cp >= 0x660 && cp <= 0x669) return false;  // Arabic-Indic digits
    return true;
  }
  return false;
}

std::string ToLowerUtf8(std::string_view s) {
  std::string out;
  out.reserve(s.size());
  const char* p = s.data();
  const char* end = s.data() + s.size();
  while (p < end) {
    const char* start = p;
    char32_t cp = 0;
    if (!NextCodepoint(&p, end, &cp)) break;
    if (cp <= 0x7F) {
      out.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(cp))));
    } else if (cp >= 0x00C0 && cp <= 0x00DE && cp != 0x00D7) {
      // Simple Latin-1 upper → lower
      char32_t low = cp + 0x20;
      // re-encode as UTF-8 (2 bytes)
      out.push_back(static_cast<char>(0xC0 | (low >> 6)));
      out.push_back(static_cast<char>(0x80 | (low & 0x3F)));
    } else {
      out.append(start, p - start);
    }
  }
  return out;
}

}  // namespace analyze
}  // namespace findx
