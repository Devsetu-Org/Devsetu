#include "labharness/cluster.h"
#include "labrpc/labrpc.h"
#include "tests/check.h"

#include <chrono>
#include <cstdio>
#include <thread>
#include <vector>

using namespace std::chrono_literals;

static void TestLabRPC() {
  labrpc::Network net(1);
  int calls = 0;
  net.Add(1, [&](const std::string&, const std::string& args) {
    ++calls;
    return args;
  });
  std::string reply;
  CHECK(net.End(0, 1)->Call("echo", "hi", &reply));
  CHECK_EQ(reply, "hi");

  net.Disconnect(1);
  CHECK(!net.End(0, 1)->Call("echo", "x", &reply));
  net.Heal();
  net.Partition({{0}, {1}});
  CHECK(!net.End(0, 1)->Call("echo", "x", &reply));
  net.Heal();
  auto end = net.End(0, 1);
  end->Close();
  CHECK(!end->Call("echo", "x", &reply));

  labrpc::Network net2(7);
  int calls2 = 0;
  net2.Add(1, [&](const std::string&, const std::string& a) {
    ++calls2;
    return a;
  });
  net2.SetUnreliable(0.5, 0);
  int ok = 0;
  for (int i = 0; i < 80; ++i) {
    if (net2.End(0, 1)->Call("echo", "z", &reply)) ++ok;
  }
  CHECK(ok > 0 && ok < 80);
  net2.SetUnreliable(0, 1);
  int before = calls2;
  for (int i = 0; i < 20; ++i) net2.End(0, 1)->Call("echo", "z", &reply);
  std::this_thread::sleep_for(20ms);
  CHECK_EQ(calls2 - before, 40);
}

static void TestInitialElection() {
  labharness::Cluster c(3);
  int leader = c.CheckOneLeader();
  auto [term, _] = c.Raft(leader)->GetState();
  CHECK(term >= 1);
  for (int i = 0; i < 3; ++i) {
    auto [t, lead] = c.Raft(i)->GetState();
    (void)lead;
    CHECK_EQ(t, term);
  }
  std::this_thread::sleep_for(600ms);
  int again = c.CheckOneLeader();
  auto [term2, __] = c.Raft(again)->GetState();
  CHECK_EQ(again, leader);
  CHECK_EQ(term2, term);
}

static void TestReElection() {
  labharness::Cluster c(3);
  int first = c.CheckOneLeader();
  c.Disconnect(first);
  int second = c.CheckOneLeader();
  CHECK(second != first);
  auto [first_term, _] = c.Raft(first)->GetState();
  c.Connect(first);
  c.Eventually(3.0, "old leader to step down", [&] {
    auto [t, is] = c.Raft(first)->GetState();
    return !is || t > first_term;
  });
  CHECK_EQ(c.CheckOneLeader(), second);
  c.Disconnect(second);
  c.Disconnect((second + 1) % 3);
  c.CheckNoLeader(0.700, {(second + 2) % 3});
  c.Connect(second);
  c.CheckOneLeader();
}

static void TestMinorityCannotWin() {
  labharness::Cluster c(5);
  int leader = c.CheckOneLeader();
  std::vector<int> minority;
  for (int i = 0; i < 5 && (int)minority.size() < 2; ++i)
    if (i != leader) minority.push_back(i);
  std::vector<int> majority;
  for (int i = 0; i < 5; ++i)
    if (i != minority[0] && i != minority[1]) majority.push_back(i);
  auto [start_term, _] = c.Raft(minority[0])->GetState();
  c.Partition({minority, majority});
  c.CheckNoLeader(1.200, minority);
  for (int i : minority) {
    auto [t, lead] = c.Raft(i)->GetState();
    (void)lead;
    CHECK(t > start_term);
  }
  c.CheckOneLeader(majority);
  c.Heal();
  c.CheckOneLeader();
}

static void TestVoteOncePerTerm() {
  labharness::Options o;
  o.manual = true;
  labharness::Cluster c(3, o);
  auto* rf = c.Raft(0);
  auto ask = [&](int term, int cand) {
    return rf->RequestVote(raft::RequestVoteArgs{term, cand, 0, 0});
  };
  auto r = ask(1, 1);
  CHECK(r.vote_granted);
  CHECK_EQ(r.term, 1);
  CHECK(!ask(1, 2).vote_granted);
  CHECK(ask(1, 1).vote_granted);
  r = ask(2, 2);
  CHECK(r.vote_granted);
  CHECK_EQ(r.term, 2);
  r = ask(1, 1);
  CHECK(!r.vote_granted);
  CHECK_EQ(r.term, 2);
}

static void TestVoteRequiresUpToDateLog() {
  labharness::Options o;
  o.manual = true;
  labharness::Cluster c(3, o);
  auto* rf = c.Raft(0);
  rf->DebugSeed(3, {{1, ""}, {1, ""}, {3, ""}});
  struct Case {
    const char* name;
    int term, last_idx, last_term;
    bool want;
  };
  Case cases[] = {
      {"older", 4, 9, 2, false},
      {"shorter", 5, 2, 3, false},
      {"equal", 6, 3, 3, true},
      {"newer", 7, 1, 4, true},
  };
  for (auto& tc : cases) {
    auto reply = rf->RequestVote(
        raft::RequestVoteArgs{tc.term, 1, tc.last_idx, tc.last_term});
    CHECK_EQ(reply.vote_granted, tc.want);
    CHECK_EQ(reply.term, tc.term);
  }
}

static void TestStepDownOnHigherTerm() {
  labharness::Cluster c(3);
  int leader = c.CheckOneLeader();
  auto [term, _] = c.Raft(leader)->GetState();
  int other = (leader + 1) % 3;
  auto reply = c.Raft(leader)->RequestVote(raft::RequestVoteArgs{term + 5, other, 0, 0});
  CHECK(reply.vote_granted);
  auto [got, is] = c.Raft(leader)->GetState();
  CHECK(!is);
  CHECK_EQ(got, term + 5);
}



static void TestBasicAppend() {
  labharness::Cluster c(3);
  c.CheckOneLeader();
  for (int want = 1; want <= 5; ++want) {
    // find leader and Start
    bool ok = false;
    for (int i = 0; i < 3; ++i) {
      auto [idx, term, is] = c.Raft(i)->Start("cmd-" + std::to_string(want));
      (void)term;
      if (is) {
        CHECK_EQ(idx, want);
        ok = true;
        break;
      }
    }
    CHECK(ok);
  }
  c.Eventually(8.0, "logs converge to 5", [&] {
    auto st = c.State(0);
    if ((int)st.log.size() != 5) return false;
    for (int i = 1; i < 3; ++i) if (c.State(i).log.size() != 5) return false;
    return true;
  });
}

int main() {
  try {
    TestLabRPC();
    TestInitialElection();
    TestReElection();
    TestMinorityCannotWin();
    TestVoteOncePerTerm();
    TestVoteRequiresUpToDateLog();
    TestStepDownOnHigherTerm();
    TestBasicAppend();
  } catch (const std::exception& e) {
    std::fprintf(stderr, "FAIL: %s\n", e.what());
    return 1;
  }
  if (g_failed) {
    std::fprintf(stderr, "some CHECKs failed\n");
    return 1;
  }
  std::printf("OK\n");
  return 0;
}
