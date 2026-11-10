#pragma once

// CRC-32C (Castagnoli). Same polynomial RocksDB, LevelDB, and Go's
// hash/crc32.Castagnoli use.

#include <cstddef>
#include <cstdint>
#include <string_view>

namespace lsmkv {
namespace wal {

uint32_t Checksum(std::string_view data);

}  // namespace wal
}  // namespace lsmkv
