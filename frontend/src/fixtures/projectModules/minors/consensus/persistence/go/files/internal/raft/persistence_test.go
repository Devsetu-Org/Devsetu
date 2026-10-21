package raft_test

import (
	"fmt"
	"math/rand"
	"path/filepath"
	"testing"
	"time"

	"github.com/devlabs/raftkv/internal/labharness"
	"github.com/devlabs/raftkv/internal/raft"
	"github.com/devlabs/raftkv/internal/storage"
)

// Chapter 4 acceptance tests: crash, restart, and the safety rules still hold.

func TestVoteSurvivesRestart(t *testing.T) {
	c := labharness.NewCluster(t, 3, labharness.Manual())
	ask := func(term, candidate int) raft.RequestVoteReply {
		var reply raft.RequestVoteReply
		c.Raft(0).RequestVote(&raft.RequestVoteArgs{Term: term, CandidateID: candidate}, &reply)
		return reply
	}

	if r := ask(5, 1); !r.VoteGranted {
		t.Fatalf("first vote in term 5 refused: %+v", r)
	}
	// The node dies right after answering. Its vote is a promise the
	// candidate may already have counted.
	c.Crash(0)
	c.Restart(0)

	st := c.State(0)
	if st.Term != 5 || st.VotedFor != 1 {
		t.Fatalf("after restart: term %d, votedFor %d; want term 5, votedFor 1 (term and vote must be saved before the reply)", st.Term, st.VotedFor)
	}
	if r := ask(5, 2); r.VoteGranted {
		t.Fatal("restarted node voted twice in term 5: two leaders could now win the same term")
	}
	if r := ask(5, 1); !r.VoteGranted {
		t.Fatal("restarted node refused the candidate it already voted for")
	}
}

func TestTermSurvivesRestart(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	c.CheckOneLeader()
	c.Submit("t", 3)
	before := make([]int, 3)
	for i := range before {
		before[i] = c.State(i).Term
	}
	for i := 0; i < 3; i++ {
		c.Crash(i)
	}
	for i := 0; i < 3; i++ {
		c.Restart(i)
		if got := c.State(i).Term; got < before[i] {
			t.Fatalf("node %d restarted in term %d, but was in term %d before the crash: terms must never go back", i, got, before[i])
		}
	}
}

func TestLogSurvivesFullRestart(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	c.CheckOneLeader()
	var want []string
	for i := 1; i <= 5; i++ {
		cmd := fmt.Sprintf("keep-%d", i)
		c.Submit(cmd, 3)
		want = append(want, cmd)
	}
	c.WaitLogs(5)

	for i := 0; i < 3; i++ {
		c.Crash(i)
	}
	for i := 0; i < 3; i++ {
		c.Restart(i)
	}
	for i := 0; i < 3; i++ {
		got := c.LogCommands(i)
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("node %d reloaded log %v, want %v", i, got, want)
		}
	}

	c.CheckOneLeader()
	idx := c.Submit("after-restart", 3)
	if idx != 6 {
		t.Fatalf("first command after the restart got index %d, want 6", idx)
	}
	// The restarted state machines replay from index 1; the harness checks
	// every replayed command against what was committed before the crash.
	c.Eventually(5*time.Second, "every node to re-apply all 6 entries", func() bool {
		for i := 0; i < 3; i++ {
			if c.Applied(i) != 6 {
				return false
			}
		}
		return true
	})
}

func TestRestartedLeaderCatchesUp(t *testing.T) {
	c := labharness.NewCluster(t, 3)
	leader := c.CheckOneLeader()
	c.Submit("one", 3)
	c.Submit("two", 3)

	c.Crash(leader)
	c.Submit("three", 2)
	c.Restart(leader)
	c.Submit("four", 3)

	log := c.WaitLogs(4)
	if fmt.Sprint(log) != "[one two three four]" {
		t.Fatalf("log = %v, want [one two three four]", log)
	}
}

func TestCrashesNeverLoseCommittedEntries(t *testing.T) {
	c := labharness.NewCluster(t, 5, labharness.WithSeed(21))
	c.Net().SetUnreliable(0.05, 0.05)
	c.Net().SetDelay(0, 8*time.Millisecond)
	rng := rand.New(rand.NewSource(21))

	committed := map[int]string{}
	down := map[int]bool{}
	for round := 0; round < 14; round++ {
		cmd := fmt.Sprintf("c%d", round)
		committed[c.Submit(cmd, 3)] = cmd

		// Crash somebody, sometimes right after a command, sometimes the
		// leader; never so many that no majority remains.
		victim := rng.Intn(5)
		if round%3 == 0 {
			if l, ok := c.Leader(); ok {
				victim = l
			}
		}
		if !down[victim] && len(down) < 2 {
			c.Crash(victim)
			down[victim] = true
		} else {
			for v := range down {
				c.Restart(v)
				delete(down, v)
				break
			}
		}
	}
	for v := range down {
		c.Restart(v)
	}
	c.Net().SetUnreliable(0, 0)
	c.Net().SetDelay(0, 0)

	final := c.Submit("final", 5)
	committed[final] = "final"
	for idx, cmd := range committed {
		if got, ok := c.Committed(idx); !ok || got != cmd {
			t.Fatalf("index %d was committed as %q, now %q", idx, cmd, got)
		}
	}
	c.Eventually(8*time.Second, "all servers to re-apply every entry", func() bool {
		for i := 0; i < 5; i++ {
			if c.Applied(i) < final {
				return false
			}
		}
		return true
	})
}

func TestClusterOnDisk(t *testing.T) {
	dir := t.TempDir()
	c := labharness.NewCluster(t, 3, labharness.WithStores(func(i int) storage.Store {
		f, err := storage.NewFile(filepath.Join(dir, fmt.Sprintf("node-%d", i)))
		if err != nil {
			t.Fatal(err)
		}
		return f
	}))
	c.CheckOneLeader()
	c.Submit("disk-1", 3)
	c.Submit("disk-2", 3)
	c.WaitLogs(2)
	for i := 0; i < 3; i++ {
		c.Crash(i)
	}
	for i := 0; i < 3; i++ {
		c.Restart(i)
	}
	c.CheckOneLeader()
	if idx := c.Submit("disk-3", 3); idx != 3 {
		t.Fatalf("command after restart got index %d, want 3", idx)
	}
	if log := c.WaitLogs(3); fmt.Sprint(log) != "[disk-1 disk-2 disk-3]" {
		t.Fatalf("log = %v", log)
	}
}
