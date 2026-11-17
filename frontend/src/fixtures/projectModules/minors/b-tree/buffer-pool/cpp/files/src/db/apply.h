#pragma once

#include "db/txn.h"
#include "wal/record.h"

#include <vector>

namespace btreekv {

class DB;

void ApplyRecords(DB* d, const std::vector<Record>& recs);

}  // namespace btreekv
