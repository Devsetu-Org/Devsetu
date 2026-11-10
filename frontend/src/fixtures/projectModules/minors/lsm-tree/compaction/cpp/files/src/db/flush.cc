#include "db/db.h"
#include "sstable/iterator.h"
#include "wal/writer.h"

#include <cstdio>
#include <system_error>

namespace lsmkv {
namespace db {

void DB::flush() {
  if (mem_.Len() == 0) return;
  uint64_t num = next_file_++;
  std::string path = TablePath(dir_, num);
  std::string tmp = path + kTmpExt;
  auto w = sstable::Create(tmp, writerOptions());
  try {
    auto it = mem_.NewIterator();
    for (it.SeekToFirst(); it.Valid(); it.Next()) {
      w->Add(it.kind(), it.Key(), it.Value());
    }
    w->Finish();
  } catch (...) {
    w->Abort();
    throw;
  }
  if (rename(tmp.c_str(), path.c_str()) != 0) {
    ::remove(tmp.c_str());
    throw std::system_error(errno, std::generic_category(), "rename");
  }
  SyncDir(dir_);
  auto t = sstable::Open(path);
  sstable::Table* raw = t.get();
  try {
    addTable(TableRef{num, std::move(t)});
  } catch (...) {
    raw->Close();
    throw;
  }
  log_->Close();
  log_.reset(wal::Create(dir_ + "/" + kWalName, opts_.sync));
  mem_.~Memtable();
  new (&mem_) Memtable();
}

}  // namespace db
}  // namespace lsmkv
