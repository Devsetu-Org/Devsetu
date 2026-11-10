#include "raft/raft.h"
#include <sstream>

namespace raft {
void Raft::Persist() {
  std::ostringstream o;
  o << current_term_ << '|' << voted_for_ << '|' << log_.size() << '|';
  for (const auto& e : log_) {
    o << e.term << '|' << e.command.size() << '|' << e.command << '|';
  }
  store_->Save(o.str());
}
void Raft::ReadPersist() {
  auto data = store_->Load();
  if (data.empty()) return;
  std::istringstream in(data);
  char bar;
  in >> current_term_ >> bar >> voted_for_ >> bar;
  size_t n; in >> n >> bar;
  log_.clear();
  for (size_t i = 0; i < n; ++i) {
    LogEntry e; size_t len;
    in >> e.term >> bar >> len >> bar;
    e.command.resize(len);
    in.read(&e.command[0], static_cast<std::streamsize>(len));
    in >> bar;
    log_.push_back(e);
  }
  if (log_.empty()) log_.push_back(LogEntry{});
}
}  // namespace raft
