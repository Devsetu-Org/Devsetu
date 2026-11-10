#pragma once

#include "wal/record.h"

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace btreekv {

// Replay reads path (missing file -> 0) and walks intact records via Scan.
// Callback receives (record, end_offset). Returns the good prefix length.
int64_t Replay(const std::string& path,
               const std::function<void(const Record&, int64_t)>& fn);

// Student: walk data; stop at the first torn/bad record; return good.
int64_t Scan(const uint8_t* data, size_t len,
             const std::function<void(const Record&, int64_t)>& fn);

}  // namespace btreekv
