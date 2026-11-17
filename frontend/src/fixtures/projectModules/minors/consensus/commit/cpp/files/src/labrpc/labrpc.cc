#include "labrpc/labrpc.h"

#include <chrono>
#include <stdexcept>
#include <thread>

namespace labrpc {

std::string Encode(const std::string& s) { return s; }
std::string Decode(const std::string& s) { return s; }

Network::Network(int64_t seed) : rng_(static_cast<uint64_t>(seed)) {}

void Network::Add(int id, Handler h) {
  std::lock_guard<std::mutex> lk(mu_);
  handlers_[id] = std::move(h);
}
void Network::Remove(int id) {
  std::lock_guard<std::mutex> lk(mu_);
  handlers_.erase(id);
}
void Network::Disconnect(int id) {
  std::lock_guard<std::mutex> lk(mu_);
  isolated_.insert(id);
}
void Network::Connect(int id) {
  std::lock_guard<std::mutex> lk(mu_);
  isolated_.erase(id);
}
void Network::Partition(const std::vector<std::vector<int>>& groups) {
  std::lock_guard<std::mutex> lk(mu_);
  group_.clear();
  for (size_t g = 0; g < groups.size(); ++g) {
    for (int id : groups[g]) group_[id] = static_cast<int>(g) + 1;
  }
}
void Network::Heal() {
  std::lock_guard<std::mutex> lk(mu_);
  group_.clear();
  isolated_.clear();
}
void Network::SetUnreliable(double drop, double dup) {
  std::lock_guard<std::mutex> lk(mu_);
  drop_rate_ = drop;
  dup_rate_ = dup;
}
void Network::SetDelay(double min_s, double max_s) {
  std::lock_guard<std::mutex> lk(mu_);
  min_delay_ = min_s;
  max_delay_ = max_s;
}
std::shared_ptr<ClientEnd> Network::End(int from, int to) {
  return std::make_shared<ClientEnd>(this, from, to);
}
bool Network::Reachable(int from, int to) {
  if (isolated_.count(from) || isolated_.count(to)) return false;
  if (from < kExternalBase) {
    int gf = group_.count(from) ? group_[from] : 0;
    int gt = group_.count(to) ? group_[to] : 0;
    if (gf != gt) return false;
  }
  return handlers_.count(to) != 0;
}
bool Network::Roll(double p) {
  return p > 0 && std::uniform_real_distribution<double>(0, 1)(rng_) < p;
}
double Network::Latency() {
  if (max_delay_ <= 0) return 0;
  double span = max_delay_ - min_delay_;
  if (span <= 0) return min_delay_;
  return min_delay_ + std::uniform_real_distribution<double>(0, span)(rng_);
}
double Network::FailDelay() {
  return (5 + std::uniform_int_distribution<int>(0, 19)(rng_)) / 1000.0;
}

ClientEnd::ClientEnd(Network* net, int from, int to) : net_(net), from_(from), to_(to) {}
void ClientEnd::Close() { closed_.store(true); }
bool ClientEnd::Cut() {
  std::lock_guard<std::mutex> lk(net_->mu_);
  return closed_.load() || !net_->Reachable(from_, to_);
}

bool ClientEnd::Call(const std::string& method, const std::string& args, std::string* reply) {
  Handler h;
  bool drop_req, drop_rep, dup;
  double req_delay, rep_delay, dup_delay, fail_wait;

  net_->mu_.lock();
  if (closed_.load() || !net_->Reachable(from_, to_)) {
    fail_wait = net_->FailDelay();
    net_->mu_.unlock();
    std::this_thread::sleep_for(std::chrono::duration<double>(fail_wait));
    return false;
  }
  drop_req = net_->Roll(net_->drop_rate_);
  drop_rep = net_->Roll(net_->drop_rate_);
  dup = net_->Roll(net_->dup_rate_);
  req_delay = net_->Latency();
  rep_delay = net_->Latency();
  dup_delay = net_->Latency();
  h = net_->handlers_[to_];
  fail_wait = net_->FailDelay();
  net_->mu_.unlock();

  std::this_thread::sleep_for(std::chrono::duration<double>(req_delay));
  if (drop_req || Cut()) {
    std::this_thread::sleep_for(std::chrono::duration<double>(fail_wait));
    return false;
  }
  if (dup) {
    auto payload = args;
    auto hh = h;
    Network* net = net_;
    std::thread([net, method, payload, hh, dup_delay]() {
      std::this_thread::sleep_for(std::chrono::duration<double>(dup_delay));
      net->BumpDelivered();
      try {
        hh(method, payload);
      } catch (...) {
      }
    }).detach();
  }
  net_->BumpDelivered();
  std::string out;
  try {
    out = h(method, args);
  } catch (...) {
    std::this_thread::sleep_for(std::chrono::duration<double>(fail_wait));
    return false;
  }
  std::this_thread::sleep_for(std::chrono::duration<double>(rep_delay));
  if (drop_rep || Cut()) {
    std::this_thread::sleep_for(std::chrono::duration<double>(fail_wait));
    return false;
  }
  *reply = std::move(out);
  return true;
}

}  // namespace labrpc
