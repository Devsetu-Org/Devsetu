#pragma once
#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <random>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace labrpc {

constexpr int kExternalBase = 1000;

struct ErrDown : std::runtime_error {
  ErrDown() : std::runtime_error("labrpc: node is down") {}
};

using Handler = std::function<std::string(const std::string& method, const std::string& args)>;

std::string Encode(const std::string& s);
std::string Decode(const std::string& s);  // identity framing via length-prefixed later; we use raw bytes for POD/json-like

// Simple typed helpers using length-prefixed binary blobs of POD-friendly structs via memcpy patterns in raft.
// For lab use we serialize with a trivial length-prefixed string payload already being the blob.

class Network;

class ClientEnd {
 public:
  ClientEnd(Network* net, int from, int to);
  void Close();
  // Returns false if lost. On success, reply is filled.
  bool Call(const std::string& method, const std::string& args, std::string* reply);

 private:
  Network* net_;
  int from_;
  int to_;
  std::atomic<bool> closed_{false};
  bool Cut();
};

class Network {
 public:
  explicit Network(int64_t seed);
  void Add(int id, Handler h);
  void Remove(int id);
  void Disconnect(int id);
  void Connect(int id);
  void Partition(const std::vector<std::vector<int>>& groups);
  void Heal();
  void SetUnreliable(double drop, double dup);
  void SetDelay(double min_s, double max_s);
  int64_t Delivered() const { return delivered_.load(); }
  void BumpDelivered() { delivered_.fetch_add(1); }
  std::shared_ptr<ClientEnd> End(int from, int to);

 private:
  friend class ClientEnd;
  bool Reachable(int from, int to);
  bool Roll(double p);
  double Latency();
  double FailDelay();

  mutable std::mutex mu_;
  std::mt19937_64 rng_;
  std::unordered_map<int, Handler> handlers_;
  std::unordered_set<int> isolated_;
  std::unordered_map<int, int> group_;
  double drop_rate_ = 0, dup_rate_ = 0;
  double min_delay_ = 0, max_delay_ = 0;
  std::atomic<int64_t> delivered_{0};
};

}  // namespace labrpc
