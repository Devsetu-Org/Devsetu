#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace findx {
namespace analyze {

// Decode one UTF-8 code point from *p; advances *p. Returns false at end/invalid.
bool NextCodepoint(const char** p, const char* end, char32_t* out);

// Unicode letter? (covers what this minor's tests need, including Latin letters).
bool IsLetter(char32_t cp);

// Unicode lowercase of a UTF-8 string.
std::string ToLowerUtf8(std::string_view s);

}  // namespace analyze
}  // namespace findx
