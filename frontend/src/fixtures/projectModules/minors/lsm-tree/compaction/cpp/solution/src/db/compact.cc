#include "db/db.h"
#include "compaction/compaction.h"
#include "sstable/iterator.h"

#include <memory>
#include <vector>

namespace lsmkv {
namespace db {

void DB::compactRange(int lo, int hi) {
  std::vector<uint64_t> input_nums;
  input_nums.reserve(static_cast<size_t>(hi - lo));
  for (int i = lo; i < hi; ++i) input_nums.push_back(tables_[static_cast<size_t>(i)].num);

  uint64_t num = next_file_++;
  std::string path = TablePath(dir_, num);
  std::string tmp = path + kTmpExt;

  std::vector<std::shared_ptr<sstable::Iterator>> holds;
  std::vector<it::Cursor> children;
  for (int i = lo; i < hi; ++i) {
    auto sit = std::make_shared<sstable::Iterator>(tables_[static_cast<size_t>(i)].t->NewIterator());
    holds.push_back(sit);
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

  auto w = sstable::Create(tmp, writerOptions());
  try {
    compaction::Merge(std::move(children), w.get(), hi == static_cast<int>(tables_.size()));
    for (auto& sit : holds) {
      if (sit->Err()) throw std::runtime_error(sit->Err());
    }
    w->Finish();
  } catch (...) {
    w->Abort();
    throw;
  }
  if (rename(tmp.c_str(), path.c_str()) != 0) {
    ::remove(tmp.c_str());
    throw std::runtime_error("rename");
  }
  SyncDir(dir_);
  auto t = sstable::Open(path);
  TableRef out{num, std::move(t)};

  std::vector<TableRef> tables;
  tables.reserve(tables_.size() - static_cast<size_t>(hi - lo) + 1);
  for (int i = 0; i < lo; ++i) tables.push_back(std::move(tables_[static_cast<size_t>(i)]));
  tables.push_back(std::move(out));
  for (int i = hi; i < static_cast<int>(tables_.size()); ++i) {
    tables.push_back(std::move(tables_[static_cast<size_t>(i)]));
  }

  std::vector<std::unique_ptr<sstable::Table>> old_tables;
  old_tables.reserve(input_nums.size());
  for (int i = lo; i < hi; ++i) old_tables.push_back(std::move(tables_[static_cast<size_t>(i)].t));

  saveManifest(tables);
  tables_ = std::move(tables);
  for (size_t i = 0; i < old_tables.size(); ++i) {
    if (old_tables[i]) old_tables[i]->Close();
    ::remove(TablePath(dir_, input_nums[i]).c_str());
  }
  ++compactions_;
}

}  // namespace db
}  // namespace lsmkv
