#include "labharness/cluster.h"

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <stdexcept>
#include <thread>

namespace labharness {

Cluster::Cluster(int n, Options opts) : n_(n), opts_(std::move(opts)) {
  if (opts_.manual) {
    opts_.timing.election_min = 3600;
    opts_.timing.election_max = 7200;
  }
  net_ = std::make_unique<labrpc::Network>(opts_.seed);
  rafts_.resize(n);
  ends_.resize(n);
  durable_.resize(n);
  fences_.resize(n);
  up_.assign(n, false);
  cut_.assign(n, false);
  gen_.assign(n, 0);
  for (int i = 0; i < n; ++i) {
    durable_[i] = opts_.stores ? opts_.stores(i) : std::make_shared<storage::Mem>();
  }
  for (int i = 0; i < n; ++i) Start(i);
  monitor_ = std::thread([this] { Monitor(); });
}

Cluster::~Cluster() { Shutdown(); }

void Cluster::Start(int i) {
  int gen;
  std::shared_ptr<storage::Fenced> fence;
  std::vector<std::shared_ptr<labrpc::ClientEnd>> ends;
  {
    std::lock_guard<std::mutex> lk(mu_);
    ++gen_[i];
    gen = gen_[i];
    fences_[i] = std::make_shared<storage::Fenced>(durable_[i]);
    fence = fences_[i];
    ends.clear();
    for (int j = 0; j < n_; ++j) ends.push_back(net_->End(i, j));
    ends_[i] = ends;
  }
  raft::Config cfg;
  cfg.me = i;
  cfg.peers = ends;
  cfg.store = fence;
  cfg.sm = nullptr;
  cfg.timing = opts_.timing;
  cfg.seed = opts_.seed + static_cast<int64_t>(gen) * 104729;
  auto rf = raft::Make(std::move(cfg));
  {
    std::lock_guard<std::mutex> lk(mu_);
    rafts_[i] = std::move(rf);
    up_[i] = true;
  }
  raft::Raft* raw = Raft(i);
  net_->Add(i, [raw](const std::string& m, const std::string& a) { return raw->Handle(m, a); });
}

void Cluster::Shutdown() {
  if (shut_) return;
  shut_ = true;
  stop_.store(true);
  if (monitor_.joinable()) monitor_.join();
  std::lock_guard<std::mutex> lk(mu_);
  for (int i = 0; i < n_; ++i) {
    if (rafts_[i]) {
      rafts_[i]->Kill();
      for (auto& e : ends_[i]) e->Close();
      if (fences_[i]) fences_[i]->Fence();
    }
  }
}

raft::Raft* Cluster::Raft(int i) {
  std::lock_guard<std::mutex> lk(mu_);
  return rafts_[i].get();
}
raft::State Cluster::State(int i) { return Raft(i)->DebugState(); }
void Cluster::Disconnect(int i) {
  { std::lock_guard<std::mutex> lk(mu_); cut_[i] = true; }
  net_->Disconnect(i);
}
void Cluster::Connect(int i) {
  { std::lock_guard<std::mutex> lk(mu_); cut_[i] = false; }
  net_->Connect(i);
}
void Cluster::Partition(const std::vector<std::vector<int>>& groups) { net_->Partition(groups); }
void Cluster::Heal() {
  { std::lock_guard<std::mutex> lk(mu_); std::fill(cut_.begin(), cut_.end(), false); }
  net_->Heal();
}
void Cluster::Crash(int i) {
  std::unique_ptr<raft::Raft> rf;
  std::vector<std::shared_ptr<labrpc::ClientEnd>> ends;
  std::shared_ptr<storage::Fenced> fence;
  {
    std::lock_guard<std::mutex> lk(mu_);
    if (!up_[i]) return;
    up_[i] = false;
    rf = std::move(rafts_[i]);
    ends = ends_[i];
    fence = fences_[i];
  }
  net_->Remove(i);
  for (auto& e : ends) e->Close();
  if (fence) fence->Fence();
  if (rf) rf->Kill();
}
void Cluster::Restart(int i) {
  { std::lock_guard<std::mutex> lk(mu_); if (up_[i]) Fail("Restart on up node"); }
  Start(i);
}
bool Cluster::Up(int i) {
  std::lock_guard<std::mutex> lk(mu_);
  return up_[i];
}
void Cluster::Campaign(int i) { Raft(i)->DebugElect(); }

void Cluster::Fail(const std::string& msg) {
  throw std::runtime_error(msg);
}

std::vector<int> Cluster::Live(const std::vector<int>& nodes) {
  if (!nodes.empty()) return nodes;
  std::lock_guard<std::mutex> lk(mu_);
  std::vector<int> out;
  for (int i = 0; i < n_; ++i) if (up_[i] && !cut_[i]) out.push_back(i);
  return out;
}

std::pair<std::vector<int>, std::vector<int>> Cluster::LeadersAmong(const std::vector<int>& set) {
  std::vector<int> ids, terms;
  for (int i : set) {
    if (!Up(i)) continue;
    auto [term, is] = Raft(i)->GetState();
    if (is) { ids.push_back(i); terms.push_back(term); }
  }
  return {ids, terms};
}

int Cluster::CheckOneLeader(const std::vector<int>& nodes) {
  auto set = Live(nodes);
  auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
  while (true) {
    {
      std::lock_guard<std::mutex> lk(mu_);
      if (!fatal_.empty()) Fail(fatal_);
    }
    auto [ids, terms] = LeadersAmong(set);
    if (ids.size() == 1) return ids[0];
    for (size_t a = 0; a < ids.size(); ++a)
      for (size_t b = a + 1; b < ids.size(); ++b)
        if (terms[a] == terms[b])
          Fail("two leaders same term");
    if (std::chrono::steady_clock::now() > deadline) Fail("no single leader in 5s");
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
  }
}

void Cluster::CheckNoLeader(double window_s, const std::vector<int>& nodes) {
  auto set = Live(nodes);
  auto end = std::chrono::steady_clock::now() + std::chrono::duration<double>(window_s);
  while (std::chrono::steady_clock::now() < end) {
    auto [ids, terms] = LeadersAmong(set);
    if (!ids.empty()) Fail("unexpected leader");
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
}

void Cluster::Eventually(double d, const std::string& msg, std::function<bool()> cond) {
  auto deadline = std::chrono::steady_clock::now() + std::chrono::duration<double>(d);
  while (!cond()) {
    if (std::chrono::steady_clock::now() > deadline) Fail("timeout: " + msg);
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
  }
}

void Cluster::Monitor() {
  int round = 0;
  while (!stop_.load()) {
    std::this_thread::sleep_for(std::chrono::milliseconds(8));
    std::vector<raft::State> states;
    for (int i = 0; i < n_; ++i) if (Up(i)) states.push_back(State(i));
    {
      std::lock_guard<std::mutex> lk(mu_);
      for (const auto& st : states) {
        if (st.role != raft::Role::Leader) continue;
        auto it = leaders_.find(st.term);
        if (it != leaders_.end() && it->second != st.id) {
          fatal_ = "SAFETY: two leaders same term";
        }
        leaders_[st.term] = st.id;
      }
    }
    ++round;
  }
}

}  // namespace labharness
