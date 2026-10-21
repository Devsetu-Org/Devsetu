package kv

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"
)

// Chapter 5 acceptance tests: the whole store, end to end, with partitions.

func startCluster(t *testing.T, n int, opts ...ClusterOption) *Cluster {
	t.Helper()
	c, err := StartCluster(n, opts...)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Shutdown)
	return c
}

func waitLeader(t *testing.T, c *Cluster) int {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if l, ok := c.Leader(); ok {
			return l
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("no leader after 5s")
	return -1
}

func mustPut(t *testing.T, ck *Clerk, k, v string) {
	t.Helper()
	if err := ck.Put([]byte(k), []byte(v)); err != nil {
		t.Fatalf("Put(%q): %v", k, err)
	}
}

func mustGet(t *testing.T, ck *Clerk, k string) (string, bool) {
	t.Helper()
	v, ok, err := ck.Get([]byte(k))
	if err != nil {
		t.Fatalf("Get(%q): %v", k, err)
	}
	return string(v), ok
}

func TestPutGetDelete(t *testing.T) {
	c := startCluster(t, 3)
	ck := c.NewClerk()

	if _, ok := mustGet(t, ck, "missing"); ok {
		t.Fatal("Get found a key nobody wrote")
	}
	mustPut(t, ck, "lang", "go")
	if v, ok := mustGet(t, ck, "lang"); !ok || v != "go" {
		t.Fatalf("Get = %q, %v; want go, true", v, ok)
	}
	mustPut(t, ck, "lang", "rust")
	if v, _ := mustGet(t, ck, "lang"); v != "rust" {
		t.Fatalf("Get after overwrite = %q, want rust", v)
	}
	if err := ck.Delete([]byte("lang")); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, ok := mustGet(t, ck, "lang"); ok {
		t.Fatal("key survived Delete")
	}
}

func TestFollowerRedirectsToLeader(t *testing.T) {
	c := startCluster(t, 3)
	leader := waitLeader(t, c)
	mustPut(t, c.NewClerk(), "warm", "up") // make sure followers know who leads

	follower := (leader + 1) % 3
	var reply ExecuteReply
	c.Server(follower).Execute(&ExecuteArgs{Op: Op{Kind: OpPut, Key: []byte("k"), Value: []byte("v"), ClientID: 900, Seq: 1}}, &reply)
	if reply.Err != ErrNotLeader {
		t.Fatalf("a follower answered Err = %q, want %q", reply.Err, ErrNotLeader)
	}
	if reply.Leader != leader {
		t.Fatalf("follower pointed to server %d, want the leader %d", reply.Leader, leader)
	}
	if _, ok := mustGet(t, c.NewClerk(), "k"); ok {
		t.Fatal("a follower applied a write it should have refused")
	}
}

func TestLeaderFailover(t *testing.T) {
	c := startCluster(t, 3)
	ck := c.NewClerk()
	mustPut(t, ck, "before", "1")

	old := waitLeader(t, c)
	c.Crash(old)
	mustPut(t, ck, "during", "2")
	if v, ok := mustGet(t, ck, "before"); !ok || v != "1" {
		t.Fatalf("lost a committed write across failover: %q, %v", v, ok)
	}

	c.Restart(old)
	mustPut(t, ck, "after", "3")
	for _, k := range []string{"before", "during", "after"} {
		if _, ok := mustGet(t, ck, k); !ok {
			t.Fatalf("key %q missing after the old leader rejoined", k)
		}
	}
}

func TestMinorityLeaderCannotCommitOrServeReads(t *testing.T) {
	c := startCluster(t, 5)
	ck := c.NewClerk()
	mustPut(t, ck, "k", "old")

	stale := waitLeader(t, c)
	buddy := (stale + 1) % 5
	var majority []int
	for i := 0; i < 5; i++ {
		if i != stale && i != buddy {
			majority = append(majority, i)
		}
	}
	c.Partition([]int{stale, buddy}, majority)

	// The deposed leader does not know it yet. It must not commit a write,
	// and it must not answer a read from its own stale map.
	var w, r ExecuteReply
	c.Server(stale).Execute(&ExecuteArgs{Op: Op{Kind: OpPut, Key: []byte("k"), Value: []byte("minority"), ClientID: 901, Seq: 1}}, &w)
	if w.Err == "" {
		t.Fatal("a leader cut off from its majority committed a Put")
	}
	c.Server(stale).Execute(&ExecuteArgs{Op: Op{Kind: OpGet, Key: []byte("k"), ClientID: 901, Seq: 2}}, &r)
	if r.Err == "" {
		t.Fatalf("a leader cut off from its majority answered a Get (%q): a stale read", r.Value)
	}

	// The majority side keeps going, through a clerk that reaches everyone.
	mustPut(t, ck, "k", "majority")
	c.Heal()
	waitLeader(t, c)
	if v, _ := mustGet(t, ck, "k"); v != "majority" {
		t.Fatalf("after healing Get = %q, want majority", v)
	}
}

func TestDuplicateRequestsApplyOnce(t *testing.T) {
	c := startCluster(t, 3)
	leader := waitLeader(t, c)
	exec := func(op Op) ExecuteReply {
		var reply ExecuteReply
		for i := 0; i < 20; i++ {
			c.Server(leader).Execute(&ExecuteArgs{Op: op}, &reply)
			if reply.Err == "" {
				return reply
			}
			time.Sleep(50 * time.Millisecond)
		}
		t.Fatalf("Execute kept failing: %s", reply.Err)
		return reply
	}
	key := []byte("k")
	exec(Op{Kind: OpPut, Key: key, Value: []byte("a"), ClientID: 41, Seq: 1})
	exec(Op{Kind: OpPut, Key: key, Value: []byte("b"), ClientID: 42, Seq: 1})
	// Client 41's retry of its first request shows up late.
	exec(Op{Kind: OpPut, Key: key, Value: []byte("a"), ClientID: 41, Seq: 1})
	got := exec(Op{Kind: OpGet, Key: key, ClientID: 43, Seq: 1})
	if string(got.Value) != "b" {
		t.Fatalf("Get = %q, want b: a retried Put was applied a second time", got.Value)
	}
}

func TestConcurrentClientsOnLossyNetwork(t *testing.T) {
	c := startCluster(t, 5, WithSeed(7))
	waitLeader(t, c)
	c.Net().SetUnreliable(0.1, 0.15)
	c.Net().SetDelay(0, 8*time.Millisecond)

	const clients, rounds = 4, 15
	var wg sync.WaitGroup
	errs := make(chan error, clients)
	for id := 0; id < clients; id++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			ck := c.NewClerk()
			key := fmt.Sprintf("client-%d", id)
			for i := 0; i < rounds; i++ {
				val := fmt.Sprintf("v%d", i)
				if err := ck.Put([]byte(key), []byte(val)); err != nil {
					errs <- fmt.Errorf("client %d Put: %v", id, err)
					return
				}
				got, ok, err := ck.Get([]byte(key))
				if err != nil || !ok || string(got) != val {
					errs <- fmt.Errorf("client %d read %q (ok=%v, err=%v) right after writing %q", id, got, ok, err, val)
					return
				}
			}
		}(id)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
}

func TestSurvivesPartitionsAndCrashesUnderLoad(t *testing.T) {
	c := startCluster(t, 5, WithSeed(3))
	waitLeader(t, c)

	stop := make(chan struct{})
	var wg sync.WaitGroup
	type outcome struct {
		last string
		err  error
	}
	results := make([]outcome, 3)
	for id := range results {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			ck := c.NewClerk()
			ck.Timeout = 20 * time.Second
			key := fmt.Sprintf("load-%d", id)
			for i := 0; ; i++ {
				select {
				case <-stop:
					return
				default:
				}
				val := fmt.Sprintf("%d", i)
				if err := ck.Put([]byte(key), []byte(val)); err != nil {
					results[id].err = err
					return
				}
				results[id].last = val
			}
		}(id)
	}

	rng := rand.New(rand.NewSource(3))
	for round := 0; round < 5; round++ {
		if round%2 == 0 {
			a, b := rng.Intn(5), rng.Intn(5)
			var rest []int
			for i := 0; i < 5; i++ {
				if i != a && i != b {
					rest = append(rest, i)
				}
			}
			if a == b {
				c.Partition([]int{a}, rest)
			} else {
				c.Partition([]int{a, b}, rest)
			}
			time.Sleep(700 * time.Millisecond)
			c.Heal()
		} else {
			victim := rng.Intn(5)
			c.Crash(victim)
			time.Sleep(700 * time.Millisecond)
			c.Restart(victim)
		}
		time.Sleep(300 * time.Millisecond)
	}
	close(stop)
	wg.Wait()
	c.Heal()
	waitLeader(t, c)

	ck := c.NewClerk()
	for id, res := range results {
		if res.err != nil {
			t.Fatalf("client %d gave up: %v", id, res.err)
		}
		if res.last == "" {
			t.Fatalf("client %d never completed a Put", id)
		}
		if v, _ := mustGet(t, ck, fmt.Sprintf("load-%d", id)); v != res.last {
			t.Fatalf("client %d's last acknowledged Put was %q, but Get returns %q", id, res.last, v)
		}
	}
}

func TestWholeClusterRestart(t *testing.T) {
	c := startCluster(t, 3, WithDir(t.TempDir()))
	ck := c.NewClerk()
	for i := 0; i < 10; i++ {
		mustPut(t, ck, fmt.Sprintf("k%d", i), fmt.Sprintf("v%d", i))
	}
	for i := 0; i < 3; i++ {
		c.Crash(i)
	}
	for i := 0; i < 3; i++ {
		c.Restart(i)
	}
	ck = c.NewClerk()
	for i := 0; i < 10; i++ {
		if v, ok := mustGet(t, ck, fmt.Sprintf("k%d", i)); !ok || v != fmt.Sprintf("v%d", i) {
			t.Fatalf("k%d = %q, %v after restarting every server", i, v, ok)
		}
	}
	mustPut(t, ck, "k0", "changed")
	if v, _ := mustGet(t, ck, "k0"); v != "changed" {
		t.Fatalf("Get = %q after a post-restart Put", v)
	}
}
