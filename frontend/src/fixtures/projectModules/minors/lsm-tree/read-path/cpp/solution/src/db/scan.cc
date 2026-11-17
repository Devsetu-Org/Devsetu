#include "db/db.h"
#include "iterator/merging.h"
#include "memtable/iterator.h"
#include "sstable/iterator.h"

#include <memory>
#include <vector>

namespace lsmkv {
namespace db {

void DB::Scan(std::string_view start, std::string_view end,
              const std::function<bool(std::string_view, std::string_view)>& fn) {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();

  auto mem_it = std::make_shared<Iterator>(mem_.NewIterator());
  std::vector<std::shared_ptr<sstable::Iterator>> table_iters;
  std::vector<it::Cursor> children;

  it::Cursor mc;
  mc.SeekToFirst = [mem_it] { mem_it->SeekToFirst(); };
  mc.Seek = [mem_it](std::string_view t) { mem_it->Seek(t); };
  mc.Valid = [mem_it] { return mem_it->Valid(); };
  mc.Next = [mem_it] { mem_it->Next(); };
  mc.Key = [mem_it] { return mem_it->Key(); };
  mc.Value = [mem_it] { return mem_it->Value(); };
  mc.kind = [mem_it] { return mem_it->kind(); };
  children.push_back(std::move(mc));

  for (auto& tb : tables_) {
    auto sit = std::make_shared<sstable::Iterator>(tb.t->NewIterator());
    table_iters.push_back(sit);
    it::Cursor c;
    c.SeekToFirst = [sit] { sit->SeekToFirst(); };
    c.Seek = [sit](std::string_view t) { sit->Seek(t); };
    c.Valid = [sit] { return sit->Valid(); };
    c.Next = [sit] { sit->Next(); };
    c.Key = [sit] { return sit->Key(); };
    c.Value = [sit] { return sit->Value(); };
    c.kind = [sit] { return sit->kind(); };
    children.push_back(std::move(c));
  }

  it::Merging m(std::move(children));
  if (start.empty()) m.SeekToFirst();
  else m.Seek(start);
  for (; m.Valid(); m.Next()) {
    if (!end.empty() && m.Key().compare(end) >= 0) break;
    if (m.kind() == Kind::kTombstone) continue;
    if (!fn(m.Key(), m.Value())) break;
  }
  for (auto& sit : table_iters) {
    if (sit->Err()) throw std::runtime_error(sit->Err());
  }
}

}  // namespace db
}  // namespace lsmkv
