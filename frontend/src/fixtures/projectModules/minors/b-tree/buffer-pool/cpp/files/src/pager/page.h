#pragma once

// Page size, header layout, free-page layout, and CRC-32C.

#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

namespace btreekv {

constexpr uint32_t kPageSize = 4096;
constexpr uint32_t kTrailerSize = 4;
constexpr uint32_t kUsable = kPageSize - kTrailerSize;

using PageNo = uint32_t;

struct Meta {
  PageNo root = 0;
  PageNo page_count = 0;
  PageNo free_head = 0;
};

class ChecksumError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

class BadPageError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

class CorruptError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

// CRC-32C (Castagnoli), matching Go's hash/crc32.Castagnoli.
uint32_t Crc32c(const uint8_t* data, size_t len);

void EncodeHeader(uint8_t* buf, const Meta& m);
Meta DecodeHeader(const uint8_t* buf);
void EncodeFreePage(uint8_t* buf, PageNo next);
PageNo DecodeFreePage(const uint8_t* buf);
void CheckBuf(const uint8_t* buf, size_t len);

}  // namespace btreekv
