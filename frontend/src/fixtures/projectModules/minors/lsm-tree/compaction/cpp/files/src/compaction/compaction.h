#pragma once
#include <vector>
#include "iterator/merging.h"
#include "sstable/writer.h"
namespace lsmkv { namespace compaction {
struct Stats { int written = 0; int dropped_tombstones = 0; };
Stats Merge(std::vector<it::Cursor> inputs, sstable::Writer* w, bool drop_tombstones);
}} 
