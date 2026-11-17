#pragma once
#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace tinygit {

struct Hash {
  std::array<uint8_t, 20> bytes{};
  std::string Hex() const;
  bool IsZero() const;
  bool operator==(const Hash& o) const { return bytes == o.bytes; }
  bool operator!=(const Hash& o) const { return !(*this == o); }
};

inline bool operator<(const Hash& a, const Hash& b) { return a.bytes < b.bytes; }

extern const Hash kZero;

Hash HashOf(const std::vector<uint8_t>& data);
Hash HashOf(const uint8_t* data, size_t n);
Hash ParseHex(const std::string& s);

}  // namespace tinygit

namespace std {
template <>
struct hash<tinygit::Hash> {
  size_t operator()(const tinygit::Hash& h) const noexcept {
    size_t x = 0;
    for (uint8_t b : h.bytes) x = x * 131 + b;
    return x;
  }
};
}  // namespace std
