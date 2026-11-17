#include "sstable/writer.h"
#include <unistd.h>
namespace lsmkv { namespace sstable {
void Writer::add(Kind kind, std::string_view key, std::string_view value) {
  if (entries_ > 0 && key.compare(last_key_) <= 0) throw OutOfOrderError();
  AppendEntry(&block_, kind, key, value);
  last_key_.assign(key.data(), key.size());
  ++entries_;
  if (static_cast<int>(block_.size()) >= opts_.block_size) flushBlock();
}
void Writer::flushBlock() {
  if (block_.empty()) return;
  Handle h = WriteBlock(block_);
  AppendIndexEntry(&index_, last_key_, h);
  block_.clear();
}
void Writer::finish(Handle filter) {
  Handle index = WriteBlock(index_);
  std::string footer = EncodeFooter(filter, index);
  if (fwrite(footer.data(), 1, footer.size(), f_) != footer.size()) throw std::runtime_error("footer");
  if (fflush(f_) != 0) throw std::runtime_error("fflush");
  if (fsync(fileno(f_)) != 0) throw std::runtime_error("fsync");
  fclose(f_);
  f_ = nullptr;
}
}}  // namespace
