#include "raft/raft.h"
#include <sstream>

namespace raft {

static void put_i(std::ostringstream& o, int v) { o << v << '|'; }
static int get_i(std::istringstream& in) {
  std::string tok;
  std::getline(in, tok, '|');
  return std::stoi(tok);
}

std::string Raft::EncodeRVArgs(const RequestVoteArgs& a) {
  std::ostringstream o;
  put_i(o, a.term); put_i(o, a.candidate_id); put_i(o, a.last_log_index); put_i(o, a.last_log_term);
  return o.str();
}
RequestVoteArgs Raft::DecodeRVArgs(const std::string& s) {
  std::istringstream in(s);
  RequestVoteArgs a;
  a.term = get_i(in); a.candidate_id = get_i(in); a.last_log_index = get_i(in); a.last_log_term = get_i(in);
  return a;
}
std::string Raft::EncodeRVReply(const RequestVoteReply& r) {
  std::ostringstream o; put_i(o, r.term); put_i(o, r.vote_granted ? 1 : 0); return o.str();
}
RequestVoteReply Raft::DecodeRVReply(const std::string& s) {
  std::istringstream in(s);
  RequestVoteReply r; r.term = get_i(in); r.vote_granted = get_i(in) != 0; return r;
}

std::string Raft::EncodeAEArgs(const AppendEntriesArgs& a) {
  std::ostringstream o;
  put_i(o, a.term); put_i(o, a.leader_id); put_i(o, a.prev_log_index); put_i(o, a.prev_log_term);
  put_i(o, a.leader_commit); put_i(o, static_cast<int>(a.entries.size()));
  for (const auto& e : a.entries) {
    put_i(o, e.term);
    put_i(o, static_cast<int>(e.command.size()));
    o << e.command << '|';
  }
  return o.str();
}
AppendEntriesArgs Raft::DecodeAEArgs(const std::string& s) {
  std::istringstream in(s);
  AppendEntriesArgs a;
  a.term = get_i(in); a.leader_id = get_i(in); a.prev_log_index = get_i(in); a.prev_log_term = get_i(in);
  a.leader_commit = get_i(in);
  int n = get_i(in);
  a.entries.resize(n);
  for (int i = 0; i < n; ++i) {
    a.entries[i].term = get_i(in);
    int len = get_i(in);
    a.entries[i].command.resize(len);
    in.read(&a.entries[i].command[0], len);
    char bar; in.get(bar);
  }
  return a;
}
std::string Raft::EncodeAEReply(const AppendEntriesReply& r) {
  std::ostringstream o; put_i(o, r.term); put_i(o, r.success ? 1 : 0); put_i(o, r.conflict_index); return o.str();
}
AppendEntriesReply Raft::DecodeAEReply(const std::string& s) {
  std::istringstream in(s);
  AppendEntriesReply r; r.term = get_i(in); r.success = get_i(in) != 0; r.conflict_index = get_i(in); return r;
}

}  // namespace raft
