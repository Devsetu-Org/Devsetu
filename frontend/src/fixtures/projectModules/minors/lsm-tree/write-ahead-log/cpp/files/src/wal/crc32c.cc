#include "wal/crc32c.h"

namespace lsmkv {
namespace wal {
namespace {

// Castagnoli polynomial 0x1EDC6F41, reflected.
constexpr uint32_t kPoly = 0x82F63B78;

uint32_t* Table() {
  static uint32_t table[256];
  static bool ready = false;
  if (!ready) {
    for (uint32_t i = 0; i < 256; ++i) {
      uint32_t crc = i;
      for (int j = 0; j < 8; ++j) {
        crc = (crc & 1) ? (crc >> 1) ^ kPoly : (crc >> 1);
      }
      table[i] = crc;
    }
    ready = true;
  }
  return table;
}

}  // namespace

uint32_t Checksum(std::string_view data) {
  const uint32_t* table = Table();
  uint32_t crc = 0xFFFFFFFFu;
  for (unsigned char b : data) {
    crc = table[(crc ^ b) & 0xFFu] ^ (crc >> 8);
  }
  return crc ^ 0xFFFFFFFFu;
}

}  // namespace wal
}  // namespace lsmkv
