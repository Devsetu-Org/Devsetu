package raft_test

import (
	"testing"
	"time"

	"github.com/devlabs/raftkv/internal/labharness"
	"github.com/devlabs/raftkv/internal/raft"
)

// Chapter 1 acceptance tests: terms, votes, and leaders.

func TestInitialElection(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	leader := c.CheckOneLeader()
	term, _ := c.Raft(leader).GetState()
	if term < 1 {
		t.Fatalf("leader %d is in term %d; the first election must move past term 0", leader, term)
	}
	for i := 0; i < 3; i++ {
		if got, _ := c.Raft(i).GetState(); got != term {
			t.Fatalf("node %d is in term %d, leader %d is in term %d: followers must adopt the leader's term", i, got, leader, term)
		}
	}

	// With heartbeats flowing nobody should campaign again: same leader, same term.
	time.Sleep(600 * time.Millisecond)
	again := c.CheckOneLeader()
	term2, _ := c.Raft(again).GetState()
	if again != leader || term2 != term {
		t.Fatalf("leader changed from %d (term %d) to %d (term %d) with a healthy network: heartbeats must reset follower timers",
			leader, term, again, term2)
	}
}

func TestReElection(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	first := c.CheckOneLeader()

	c.Disconnect(first)
	second := c.CheckOneLeader()
	if second == first {
		t.Fatalf("disconnected leader %d is still the only leader", first)
	}

	// The old leader returns. It must notice the higher term and step down,
	// not fight for the job.
	firstTerm, _ := c.Raft(first).GetState()
	c.Connect(first)
	c.Eventually(3*time.Second, "old leader to step down", func() bool {
		term, isLeader := c.Raft(first).GetState()
		return !isLeader || term > firstTerm
	})
	if got := c.CheckOneLeader(); got != second {
		t.Fatalf("leadership moved from %d to %d when the old leader rejoined", second, got)
	}

	// Lose the majority: no leader can be elected, and none may claim to be one.
	c.Disconnect(second)
	c.Disconnect((second + 1) % 3)
	c.CheckNoLeader(700*time.Millisecond, (second+2)%3)

	c.Connect(second)
	c.CheckOneLeader()
}

func TestMinorityCannotWin(t *testing.T) {
	c := labharness.NewCluster(t, 5)
	leader := c.CheckOneLeader()
	var minority, majority []int
	for i := 0; i < 5 && len(minority) < 2; i++ {
		if i != leader {
			minority = append(minority, i)
		}
	}
	for i := 0; i < 5; i++ {
		if i != minority[0] && i != minority[1] {
			majority = append(majority, i)
		}
	}
	startTerm, _ := c.Raft(minority[0]).GetState()

	c.Partition(minority, majority)
	c.CheckNoLeader(1200*time.Millisecond, minority...)
	for _, i := range minority {
		if term, _ := c.Raft(i).GetState(); term <= startTerm {
			t.Fatalf("isolated node %d is still in term %d: a node that hears nothing must keep starting elections", i, term)
		}
	}
	// The majority carries on under its own leader.
	if got := c.CheckOneLeader(majority...); got != leader {
		t.Logf("majority elected %d after the partition", got)
	}

	// Healing: the minority's higher terms force a new election, but exactly
	// one leader comes out of it.
	c.Heal()
	c.CheckOneLeader()
}

func TestOneLeaderPerTermUnderChaos(t *testing.T) {
	c := labharness.NewCluster(t, 5, labharness.WithSeed(42))
	c.Net().SetUnreliable(0.1, 0.1)
	c.Net().SetDelay(0, 15*time.Millisecond)
	// The harness monitor fails the test if two nodes ever lead one term.
	for round := 0; round < 12; round++ {
		a, b := round%5, (round*2+1)%5
		c.Disconnect(a)
		if b != a {
			c.Disconnect(b)
		}
		time.Sleep(250 * time.Millisecond)
		c.Connect(a)
		c.Connect(b)
		time.Sleep(150 * time.Millisecond)
	}
	c.Net().SetUnreliable(0, 0)
	c.Net().SetDelay(0, 0)
	c.Heal()
	c.CheckOneLeader()
}

func TestVoteOncePerTerm(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	rf := c.Raft(0)

	ask := func(term, candidate int) raft.RequestVoteReply {
		var reply raft.RequestVoteReply
		rf.RequestVote(&raft.RequestVoteArgs{Term: term, CandidateID: candidate}, &reply)
		return reply
	}

	if r := ask(1, 1); !r.VoteGranted || r.Term != 1 {
		t.Fatalf("first request in term 1 = %+v, want a granted vote in term 1", r)
	}
	if r := ask(1, 2); r.VoteGranted {
		t.Fatal("node voted twice in term 1, for two different candidates")
	}
	if r := ask(1, 1); !r.VoteGranted {
		t.Fatal("the same candidate asking again in the same term must get the same answer (its first reply may have been lost)")
	}
	if r := ask(2, 2); !r.VoteGranted || r.Term != 2 {
		t.Fatalf("a new term clears the vote: request in term 2 = %+v, want granted", r)
	}
	if r := ask(1, 1); r.VoteGranted || r.Term != 2 {
		t.Fatalf("stale request for term 1 = %+v, want a refusal that reports term 2", r)
	}
}

func TestVoteRequiresUpToDateLog(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	rf := c.Raft(0)
	rf.DebugSeed(3, []raft.LogEntry{{Term: 1}, {Term: 1}, {Term: 3}}) // last: index 3, term 3

	cases := []struct {
		name        string
		term        int
		lastIdx     int
		lastTerm    int
		wantGranted bool
	}{
		{"older last term, longer log", 4, 9, 2, false},
		{"same last term, shorter log", 5, 2, 3, false},
		{"same last term, same length", 6, 3, 3, true},
		{"newer last term, shorter log", 7, 1, 4, true},
	}
	for _, tc := range cases {
		var reply raft.RequestVoteReply
		rf.RequestVote(&raft.RequestVoteArgs{Term: tc.term, CandidateID: 1, LastLogIndex: tc.lastIdx, LastLogTerm: tc.lastTerm}, &reply)
		if reply.VoteGranted != tc.wantGranted {
			t.Errorf("%s: granted = %v, want %v", tc.name, reply.VoteGranted, tc.wantGranted)
		}
		if reply.Term != tc.term {
			t.Errorf("%s: reply term = %d, want %d (a higher term is adopted even when the vote is refused)", tc.name, reply.Term, tc.term)
		}
	}
}

func TestStepDownOnHigherTerm(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	leader := c.CheckOneLeader()
	term, _ := c.Raft(leader).GetState()
	other := (leader + 1) % 3

	var reply raft.RequestVoteReply
	c.Raft(leader).RequestVote(&raft.RequestVoteArgs{Term: term + 5, CandidateID: other}, &reply)
	if !reply.VoteGranted {
		t.Fatalf("a leader asked for a vote in term %d (> its own %d) must step down and vote: %+v", term+5, term, reply)
	}
	got, isLeader := c.Raft(leader).GetState()
	if isLeader || got != term+5 {
		t.Fatalf("after seeing term %d the old leader is (term %d, leader %v), want (term %d, follower)", term+5, got, isLeader, term+5)
	}
}
