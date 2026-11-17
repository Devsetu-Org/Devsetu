#pragma once

#include <cstdint>
#include <functional>
#include <string>

#include "wal/record.h"

namespace lsmkv {
namespace wal {

// Calls fn for every intact record in the log at path, oldest first.
//
// Stops at the first record that is cut short or fails its checksum.
// Everything from there on is a torn tail. Returns good, the offset just
// past the last intact record. A missing file is an empty log.
int64_t Replay(const std::string& path, const std::function<void(const Record&)>& fn);

}  // namespace wal
}  // namespace lsmkv
