package raft_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/devlabs/raftkv/internal/labharness"
	"github.com/devlabs/raftkv/internal/raft"
)

// Chapter 3 acceptance tests: what commits, when, and what gets applied. The
// harness also checks, on every apply, that all servers agree on each index.

func TestCommitAndApply(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	c.CheckOneLeader()
	for want := 1; want <= 5; want++ {
		idx := c.Submit(fmt.Sprintf("op-%d", want), 3)
		if idx != want {
			t.Fatalf("op-%d committed at index %d, want %d", want, idx, want)
		}
	}
	c.Eventually(3*time.Second, "every server to apply 5 entries", func() bool {
		for i := 0; i < 3; i++ {
			if c.Applied(i) != 5 {
				return false
			}
		}
		return true
	})
}

func TestApplyIsExactlyOnceUnderDuplicates(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.WithSeed(5))
	c.CheckOneLeader()
	c.Net().SetUnreliable(0.05, 0.5)
	for i := 1; i <= 10; i++ {
		c.Submit(fmt.Sprintf("dup-%d", i), 3)
	}
	c.Net().SetUnreliable(0, 0)
	time.Sleep(200 * time.Millisecond)
	// The harness already failed the test if any server applied an index
	// twice, skipped one, or applied out of order.
	for i := 0; i < 3; i++ {
		if got := c.Applied(i); got != 10 {
			t.Fatalf("server %d applied %d entries, want exactly 10", i, got)
		}
	}
}

func TestNoCommitWithoutMajority(t *testing.T) {
	c := labharness.NewCluster(t, 5)
	leader := c.CheckOneLeader()
	var others []int
	for i := 0; i < 5; i++ {
		if i != leader {
			others = append(others, i)
		}
	}
	// Leave the leader with one follower: two of five is not a majority.
	c.Disconnect(others[1])
	c.Disconnect(others[2])
	c.Disconnect(others[3])

	if _, _, ok := c.Raft(leader).Start([]byte("lonely")); !ok {
		t.Skip("leader changed under us; nothing to check")
	}
	time.Sleep(800 * time.Millisecond)
	if n := c.CommittedCount(); n != 0 {
		t.Fatalf("an entry stored on 2 of 5 servers was applied (%d entries committed)", n)
	}
	if st := c.State(leader); st.CommitIndex != 0 {
		t.Fatalf("leader commitIndex = %d with only 2 of 5 servers holding the entry, want 0", st.CommitIndex)
	}

	c.Heal()
	c.CheckOneLeader()
	c.Submit("after-heal", 5)
}

func TestCommitsWithMinorityDown(t *testing.T) {
	c := labharness.NewCluster(t, 5)
	leader := c.CheckOneLeader()
	c.Disconnect((leader + 1) % 5)
	c.Disconnect((leader + 2) % 5)
	// Three of five is a majority: commits must keep flowing.
	for i := 0; i < 3; i++ {
		c.Submit(fmt.Sprintf("m%d", i), 3)
	}
}

func TestCommitRuleNeedsCurrentTerm(t *testing.T) {
	c := labharness.NewCluster(t, 5, labharness.Manual())
	// Nodes 0 and 1 hold an entry from term 1 that was never committed.
	for i := 0; i < 5; i++ {
		if i < 2 {
			c.Raft(i).DebugSeed(1, []raft.LogEntry{{Term: 1, Command: []byte("old")}})
		} else {
			c.Raft(i).DebugSeed(1, nil)
		}
	}
	c.Campaign(1) // term 2; node 1's log is the most up to date, so it wins
	c.Eventually(2*time.Second, "node 1 to win", func() bool { return c.State(1).Role == raft.Leader })
	c.WaitLogs(1)

	// "old" is now on all five servers, but it is a term-1 entry. Counting
	// replicas of it would be wrong: an old-term entry on a majority can still
	// be overwritten by a later leader. It may only commit with something newer.
	time.Sleep(500 * time.Millisecond)
	for i := 0; i < 5; i++ {
		if st := c.State(i); st.CommitIndex != 0 {
			t.Fatalf("node %d commitIndex = %d: a leader committed an entry from a previous term by counting replicas", i, st.CommitIndex)
		}
	}

	if idx, _, ok := c.Raft(1).Start([]byte("new")); !ok || idx != 2 {
		t.Fatalf("Start on the leader = index %d, ok %v, want index 2", idx, ok)
	}
	c.Eventually(3*time.Second, "both entries to commit everywhere", func() bool {
		return c.CountApplied(2, "new") == 5 && c.CountApplied(1, "old") == 5
	})
}

func TestFollowerCommitIsBoundedByVerifiedEntries(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	rf := c.Raft(0)
	rf.DebugSeed(2, entries(1, 1, 2, 2, 2))

	// Heartbeat: the leader has committed 4, but this RPC verifies no entry
	// of ours. Entries 1..4 here might be from a dead history.
	var reply raft.AppendEntriesReply
	rf.AppendEntries(&raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 0, LeaderCommit: 4}, &reply)
	if st := c.State(0); !reply.Success || st.CommitIndex != 0 {
		t.Fatalf("after an empty RPC with prev=0, reply %+v commitIndex %d; want success and commitIndex 0", reply, st.CommitIndex)
	}

	// Now the RPC proves our log matches the leader's through index 3.
	rf.AppendEntries(&raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 2, PrevLogTerm: 1,
		Entries: entries(0)[:0], LeaderCommit: 9}, &reply)
	if st := c.State(0); !reply.Success || st.CommitIndex != 2 {
		t.Fatalf("leaderCommit 9 with a log verified through index 2: commitIndex = %d, want min(9, 2) = 2", st.CommitIndex)
	}
	c.Eventually(2*time.Second, "node 0 to apply the committed prefix", func() bool { return c.Applied(0) == 2 })

	// commitIndex never moves backwards.
	rf.AppendEntries(&raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 0, LeaderCommit: 0}, &reply)
	if st := c.State(0); st.CommitIndex != 2 {
		t.Fatalf("commitIndex went from 2 to %d on a heartbeat", st.CommitIndex)
	}
}

func TestUncommittedEntriesAreOverwritten(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	c.Campaign(0)
	c.Eventually(2*time.Second, "node 0 to win", func() bool { return c.State(0).Role == raft.Leader })

	c.Partition([]int{0}, []int{1, 2})
	c.Raft(0).Start([]byte("x1"))
	c.Raft(0).Start([]byte("x2"))
	time.Sleep(200 * time.Millisecond)
	if n := c.CommittedCount(); n != 0 {
		t.Fatalf("a leader cut off from its majority committed %d entries", n)
	}

	c.Campaign(1)
	c.Eventually(2*time.Second, "node 1 to win", func() bool { return c.State(1).Role == raft.Leader })
	c.Raft(1).Start([]byte("y1"))
	c.Eventually(3*time.Second, "y1 to commit on the majority side", func() bool { return c.CountApplied(1, "y1") >= 2 })

	c.Heal()
	c.Eventually(5*time.Second, "node 0 to adopt the committed history", func() bool {
		cmd, ok := c.AppliedCommand(0, 1)
		return ok && cmd == "y1"
	})
	if log := c.LogCommands(0); fmt.Sprint(log) != "[y1]" {
		t.Fatalf("old leader's log = %v, want [y1]: its uncommitted entries must be replaced", log)
	}
	if _, ok := c.Committed(2); ok {
		t.Fatal("x2 or another uncommitted entry was applied somewhere")
	}
}

func TestCommittedEntriesSurviveLeaderChanges(t *testing.T) {
	c := labharness.NewCluster(t, 5, labharness.WithSeed(11))
	committed := map[int]string{}
	for round := 0; round < 6; round++ {
		cmd := fmt.Sprintf("round-%d", round)
		committed[c.Submit(cmd, 3)] = cmd

		leader := c.CheckOneLeader()
		c.Disconnect(leader)
		cmd = fmt.Sprintf("round-%d-b", round)
		committed[c.Submit(cmd, 3)] = cmd
		c.Connect(leader)
	}
	c.Heal()
	final := c.Submit("final", 5)
	committed[final] = "final"

	for idx, cmd := range committed {
		if got, ok := c.Committed(idx); !ok || got != cmd {
			t.Fatalf("index %d was committed as %q but the cluster now says %q", idx, cmd, got)
		}
	}
	c.Eventually(5*time.Second, "every server to apply everything", func() bool {
		for i := 0; i < 5; i++ {
			if c.Applied(i) < final {
				return false
			}
		}
		return true
	})
}
