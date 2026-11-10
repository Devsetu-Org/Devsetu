#include "compaction/compaction.h"
namespace lsmkv { namespace compaction {
Stats Merge(std::vector<it::Cursor> inputs, sstable::Writer* w, bool drop_tombstones) {
  Stats st;
  it::Merging m(std::move(inputs));
  for (m.SeekToFirst(); m.Valid(); m.Next()) {
    if (m.kind() == Kind::kTombstone && drop_tombstones) { ++st.dropped_tombstones; continue; }
    w->Add(m.kind(), m.Key(), m.Value());
    ++st.written;
  }
  return st;
}
}} 
