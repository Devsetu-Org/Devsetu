#pragma once

#include "pager/page.h"

#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

namespace btreekv {

enum class WalKind : uint8_t {
  kPage = 1,
  kMeta = 2,
  kCommit = 3,
};

struct Record {
  WalKind kind = WalKind::kPage;
  uint32_t page = 0;
  std::string data;
};

constexpr size_t kWalHeaderSize = 8;
constexpr uint32_t kMaxRecordSize = 1u << 20;

class BadPayloadError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

// Append payload: kind(1) page(4 LE) dataLen(uvarint) data.
void AppendPayload(std::vector<uint8_t>* dst, const Record& r);
Record DecodePayload(const uint8_t* p, size_t len);

// Student: Encode frames a record onto dst (appends; keeps existing bytes).
void Encode(std::vector<uint8_t>* dst, const Record& r);

Record MetaRecord(uint32_t root, uint32_t page_count, uint32_t free_head);
Record CommitRecord();
void UnpackMeta(const Record& r, uint32_t* root, uint32_t* page_count, uint32_t* free_head);

}  // namespace btreekv
