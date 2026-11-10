#include "raft/raft.h"
#include <stdexcept>

namespace raft {

std::string Raft::Handle(const std::string& method, const std::string& data) {
  if (Killed()) throw labrpc::ErrDown();
  if (method == "Raft.RequestVote") {
    auto args = DecodeRVArgs(data);
    auto reply = RequestVote(args);
    return EncodeRVReply(reply);
  }
  if (method == "Raft.AppendEntries") {
    auto args = DecodeAEArgs(data);
    auto reply = AppendEntries(args);
    return EncodeAEReply(reply);
  }
  throw std::runtime_error("raft: unknown method");
}

}  // namespace raft
