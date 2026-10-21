package raft_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/devlabs/raftkv/internal/labharness"
	"github.com/devlabs/raftkv/internal/raft"
)

// Chapter 2 acceptance tests: AppendEntries and log repair. Nothing here
// needs commit or apply; it only looks at logs.

func entries(terms ...int) []raft.LogEntry {
	out := make([]raft.LogEntry, len(terms))
	for i, t := range terms {
		out[i] = raft.LogEntry{Term: t, Command: []byte(fmt.Sprintf("e%d", i+1))}
	}
	return out
}

func TestBasicAppend(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	c.CheckOneLeader()
	for want := 1; want <= 5; want++ {
		idx, _ := c.Start(fmt.Sprintf("cmd-%d", want))
		if idx != want {
			t.Fatalf("command %d got log index %d; the first entry is index 1 and each Start takes the next one", want, idx)
		}
	}
	log := c.WaitLogs(5)
	for i, cmd := range log {
		if cmd != fmt.Sprintf("cmd-%d", i+1) {
			t.Fatalf("log = %v, want cmd-1 .. cmd-5 in order", log)
		}
	}
}

func TestStartOnFollowerIsRejected(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	leader := c.CheckOneLeader()
	follower := (leader + 1) % 3
	if _, _, ok := c.Raft(follower).Start([]byte("x")); ok {
		t.Fatal("a follower accepted Start; only the leader may append")
	}
	time.Sleep(100 * time.Millisecond)
	for i := 0; i < 3; i++ {
		if n := len(c.State(i).Log); n != 0 {
			t.Fatalf("node %d has %d entries after a rejected Start", i, n)
		}
	}
}

func TestAppendEntriesConsistencyCheck(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	rf := c.Raft(0)
	rf.DebugSeed(2, entries(1, 2, 2, 2)) // terms by index: 1, 2, 2, 2

	call := func(args raft.AppendEntriesArgs) raft.AppendEntriesReply {
		var reply raft.AppendEntriesReply
		rf.AppendEntries(&args, &reply)
		return reply
	}

	if r := call(raft.AppendEntriesArgs{Term: 1, LeaderID: 1}); r.Success || r.Term != 2 {
		t.Fatalf("AppendEntries from term 1 = %+v, want a refusal that reports term 2", r)
	}
	if r := call(raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 9, PrevLogTerm: 2}); r.Success || r.ConflictIndex != 5 {
		t.Fatalf("PrevLogIndex past the end = %+v, want a refusal with ConflictIndex 5 (just past our last entry)", r)
	}
	if r := call(raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 4, PrevLogTerm: 3}); r.Success || r.ConflictIndex != 2 {
		t.Fatalf("term mismatch at index 4 = %+v, want a refusal with ConflictIndex 2 (first index of our term-2 run)", r)
	}
	if n := len(c.State(0).Log); n != 4 {
		t.Fatalf("log has %d entries after refused RPCs, want 4 untouched", n)
	}
	if r := call(raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 4, PrevLogTerm: 2,
		Entries: []raft.LogEntry{{Term: 2, Command: []byte("e5")}}}); !r.Success {
		t.Fatalf("matching PrevLog was refused: %+v", r)
	}
	if n := len(c.State(0).Log); n != 5 {
		t.Fatalf("log has %d entries after appending one, want 5", n)
	}
}

func TestAppendEntriesKeepsMatchingSuffix(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	rf := c.Raft(0)
	rf.DebugSeed(2, entries(1, 1, 2, 2, 2))

	// A delayed duplicate of an old RPC carries only the first two entries.
	// Everything it says is already true; the log must not shrink.
	var reply raft.AppendEntriesReply
	rf.AppendEntries(&raft.AppendEntriesArgs{Term: 2, LeaderID: 1, PrevLogIndex: 0, Entries: entries(1, 1)}, &reply)
	if !reply.Success {
		t.Fatalf("stale but consistent AppendEntries was refused: %+v", reply)
	}
	if n := len(c.State(0).Log); n != 5 {
		t.Fatalf("log has %d entries after a stale RPC, want 5: only truncate at a real conflict", n)
	}

	// A real conflict: the leader says index 3 holds a term-3 entry.
	rf.AppendEntries(&raft.AppendEntriesArgs{Term: 3, LeaderID: 1, PrevLogIndex: 2, PrevLogTerm: 1,
		Entries: []raft.LogEntry{{Term: 3, Command: []byte("new")}}}, &reply)
	st := c.State(0)
	if !reply.Success || len(st.Log) != 3 || st.Log[2].Term != 3 || string(st.Log[2].Command) != "new" {
		t.Fatalf("after a conflicting entry: reply %+v, log %v; want the old suffix cut and [e1 e2 new]", reply, c.LogCommands(0))
	}
}

func TestFollowerCatchesUp(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	leader := c.CheckOneLeader()
	lag := (leader + 1) % 3

	c.Start("a")
	c.Start("b")
	c.WaitLogs(2)

	c.Disconnect(lag)
	for _, cmd := range []string{"c", "d", "e"} {
		c.Start(cmd)
	}
	c.WaitLogs(5, leader, (leader+2)%3)
	if n := len(c.State(lag).Log); n != 2 {
		t.Fatalf("disconnected node has %d entries, want 2", n)
	}

	c.Connect(lag)
	log := c.WaitLogs(5)
	if fmt.Sprint(log) != "[a b c d e]" {
		t.Fatalf("log = %v, want [a b c d e]", log)
	}
}

func TestConflictingEntriesAreReplaced(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	c.Campaign(0)
	c.Eventually(2*time.Second, "node 0 to win", func() bool { return c.State(0).Role == raft.Leader })

	// The leader is cut off, but does not know yet. It accepts commands that
	// can never reach a majority.
	c.Partition([]int{0}, []int{1, 2})
	for _, cmd := range []string{"x1", "x2", "x3"} {
		if _, _, ok := c.Raft(0).Start([]byte(cmd)); !ok {
			t.Fatal("isolated leader refused Start")
		}
	}

	// The other side elects its own leader and builds a different history.
	c.Campaign(1)
	c.Eventually(2*time.Second, "node 1 to win", func() bool { return c.State(1).Role == raft.Leader })
	c.Raft(1).Start([]byte("y1"))
	c.Raft(1).Start([]byte("y2"))
	c.WaitLogs(2, 1, 2)

	// Heal: the old leader's three entries conflict with y1, y2 and must go.
	c.Heal()
	log := c.WaitLogs(2)
	if fmt.Sprint(log) != "[y1 y2]" {
		t.Fatalf("log = %v, want [y1 y2]", log)
	}
}

func TestAppendUnderLossyNetwork(t *testing.T) {
	c := labharness.NewCluster(t, 5, labharness.WithSeed(9))
	c.CheckOneLeader()
	c.Net().SetUnreliable(0.15, 0.25)
	c.Net().SetDelay(0, 10*time.Millisecond)

	for i := 0; i < 15; i++ {
		c.Start(fmt.Sprintf("n%d", i))
		time.Sleep(15 * time.Millisecond)
	}

	c.Net().SetUnreliable(0, 0)
	c.Net().SetDelay(0, 0)
	c.CheckOneLeader()
	// Dropped and duplicated RPCs must not duplicate, reorder or lose what a
	// leader holds: every node ends with the same log, each command once.
	var log []string
	c.Eventually(8*time.Second, "all logs to converge", func() bool {
		log = c.LogCommands(0)
		for i := 1; i < 5; i++ {
			got := c.LogCommands(i)
			if len(got) != len(log) {
				return false
			}
			for k := range got {
				if got[k] != log[k] {
					return false
				}
			}
		}
		return len(log) > 0
	})
	seen := map[string]bool{}
	for _, cmd := range log {
		if seen[cmd] {
			t.Fatalf("command %q appears twice in %v: a duplicated RPC was applied twice", cmd, log)
		}
		seen[cmd] = true
	}
}
