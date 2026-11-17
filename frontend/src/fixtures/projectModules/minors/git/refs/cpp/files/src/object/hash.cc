#include "object/hash.h"

#include <cstdio>
#include <cstring>
#include <vector>
#include <stdexcept>

namespace tinygit {

const Hash kZero{};

namespace {

uint32_t rol(uint32_t v, int n) { return (v << n) | (v >> (32 - n)); }

void sha1(const uint8_t* msg, size_t len, uint8_t out[20]) {
  uint32_t h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  size_t new_len = ((len + 8) / 64 + 1) * 64;
  std::vector<uint8_t> buf(new_len, 0);
  memcpy(buf.data(), msg, len);
  buf[len] = 0x80;
  uint64_t bit_len = static_cast<uint64_t>(len) * 8;
  for (int i = 0; i < 8; ++i) buf[new_len - 1 - i] = static_cast<uint8_t>(bit_len >> (8 * i));

  for (size_t chunk = 0; chunk < new_len; chunk += 64) {
    uint32_t w[80];
    for (int i = 0; i < 16; ++i) {
      w[i] = (buf[chunk + 4 * i] << 24) | (buf[chunk + 4 * i + 1] << 16) |
             (buf[chunk + 4 * i + 2] << 8) | buf[chunk + 4 * i + 3];
    }
    for (int i = 16; i < 80; ++i) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    uint32_t a = h0, b = h1, c = h2, d = h3, e = h4;
    for (int i = 0; i < 80; ++i) {
      uint32_t f, k;
      if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      uint32_t temp = rol(a, 5) + f + e + k + w[i];
      e = d; d = c; c = rol(b, 30); b = a; a = temp;
    }
    h0 += a; h1 += b; h2 += c; h3 += d; h4 += e;
  }
  uint32_t hs[5] = {h0, h1, h2, h3, h4};
  for (int i = 0; i < 5; ++i) {
    out[4 * i] = hs[i] >> 24;
    out[4 * i + 1] = hs[i] >> 16;
    out[4 * i + 2] = hs[i] >> 8;
    out[4 * i + 3] = hs[i];
  }
}

}  // namespace

std::string Hash::Hex() const {
  static const char* hexd = "0123456789abcdef";
  std::string s(40, '0');
  for (int i = 0; i < 20; ++i) {
    s[2 * i] = hexd[bytes[i] >> 4];
    s[2 * i + 1] = hexd[bytes[i] & 0xf];
  }
  return s;
}

bool Hash::IsZero() const { return *this == kZero; }

Hash HashOf(const uint8_t* data, size_t n) {
  Hash h;
  sha1(data, n, h.bytes.data());
  return h;
}

Hash HashOf(const std::vector<uint8_t>& data) { return HashOf(data.data(), data.size()); }

Hash ParseHex(const std::string& s) {
  if (s.size() != 40) throw std::runtime_error("object: bad hash length " + std::to_string(s.size()));
  Hash h;
  auto val = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  };
  for (int i = 0; i < 20; ++i) {
    int a = val(s[2 * i]), b = val(s[2 * i + 1]);
    if (a < 0 || b < 0) throw std::runtime_error("object: bad hash");
    h.bytes[i] = static_cast<uint8_t>((a << 4) | b);
  }
  return h;
}

}  // namespace tinygit
