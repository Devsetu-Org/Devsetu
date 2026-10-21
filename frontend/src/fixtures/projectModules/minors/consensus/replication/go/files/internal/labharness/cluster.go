// Package labharness runs a Raft cluster inside one process and watches it.
//
// A Cluster owns N nodes on a labrpc network. Tests cut and heal links, crash
// and restart nodes, and submit commands. Meanwhile a background monitor checks
// the safety properties Raft promises and reports a violation the moment it
// sees one, so a bug that corrupts state fails the test even if the test never
// looks at that state:
//
//   - at most one leader per term
//   - the Log Matching property between any two logs
//   - every server applies the same command at the same index, in order
package labharness

import (
	"bytes"
	"fmt"
	"sync"
	"time"

	"github.com/devlabs/raftkv/internal/labrpc"
	"github.com/devlabs/raftkv/internal/raft"
	"github.com/devlabs/raftkv/internal/storage"
)

// T is the part of testing.TB the harness uses.
type T interface {
	Helper()
	Errorf(format string, args ...any)
	Fatalf(format string, args ...any)
	Cleanup(func())
}

type options struct {
	timing raft.Timing
	seed   int64
	stores func(i int) storage.Store
	manual bool
}

// Option configures NewCluster.
type Option func(*options)

// WithTiming overrides the node timing.
func WithTiming(t raft.Timing) Option { return func(o *options) { o.timing = t } }

// WithSeed sets the random seed of the network and the nodes.
func WithSeed(seed int64) Option { return func(o *options) { o.seed = seed } }

// WithStores makes node i keep its durable state in stores(i) instead of memory.
// The store must outlive a Crash: the restarted node reads it back.
func WithStores(stores func(i int) storage.Store) Option {
	return func(o *options) { o.stores = stores }
}

// Manual disables election timeouts: no node ever campaigns on its own. A test
// picks who runs with Campaign, or pokes handlers directly.
func Manual() Option { return func(o *options) { o.manual = true } }

// FastTiming is the default for tests: elections finish in well under a second.
var FastTiming = raft.Timing{
	ElectionMin: 120 * time.Millisecond,
	ElectionMax: 240 * time.Millisecond,
	Heartbeat:   25 * time.Millisecond,
	Tick:        4 * time.Millisecond,
}

// Cluster is N Raft nodes plus their network.
type Cluster struct {
	t      T
	n      int
	net    *labrpc.Network
	timing raft.Timing
	seed   int64

	mu        sync.Mutex
	rafts     []*raft.Raft
	ends      [][]*labrpc.ClientEnd
	durable   []storage.Store
	fences    []*storage.Fenced
	up        []bool
	cut       []bool
	gen       []int
	lastApply []int
	applied   []map[int][]byte
	committed map[int][]byte // index -> command, first time any server applied it
	leaders   map[int]int    // term -> the one node seen leading it

	stop chan struct{}
	done chan struct{}
	once sync.Once
}

// NewCluster starts n nodes and the safety monitor. The cluster shuts down
// when the test ends.
func NewCluster(t T, n int, opts ...Option) *Cluster {
	t.Helper()
	o := options{timing: FastTiming, seed: 1}
	for _, opt := range opts {
		opt(&o)
	}
	if o.manual {
		o.timing.ElectionMin = time.Hour
		o.timing.ElectionMax = 2 * time.Hour
	}
	c := &Cluster{
		t:         t,
		n:         n,
		net:       labrpc.NewNetwork(o.seed),
		timing:    o.timing,
		seed:      o.seed,
		rafts:     make([]*raft.Raft, n),
		ends:      make([][]*labrpc.ClientEnd, n),
		durable:   make([]storage.Store, n),
		fences:    make([]*storage.Fenced, n),
		up:        make([]bool, n),
		cut:       make([]bool, n),
		gen:       make([]int, n),
		lastApply: make([]int, n),
		applied:   make([]map[int][]byte, n),
		committed: map[int][]byte{},
		leaders:   map[int]int{},
		stop:      make(chan struct{}),
		done:      make(chan struct{}),
	}
	for i := 0; i < n; i++ {
		if o.stores != nil {
			c.durable[i] = o.stores(i)
		} else {
			c.durable[i] = storage.NewMem()
		}
	}
	for i := 0; i < n; i++ {
		c.start(i)
	}
	go c.monitor()
	t.Cleanup(c.Shutdown)
	return c
}

// start boots node i on its durable store. c.mu must not be held.
func (c *Cluster) start(i int) {
	c.mu.Lock()
	c.gen[i]++
	gen := c.gen[i]
	c.lastApply[i] = 0
	c.applied[i] = map[int][]byte{}
	c.fences[i] = storage.NewFenced(c.durable[i])
	fence := c.fences[i]
	ends := make([]*labrpc.ClientEnd, c.n)
	peers := make([]raft.Peer, c.n)
	for j := 0; j < c.n; j++ {
		ends[j] = c.net.End(i, j)
		peers[j] = ends[j]
	}
	c.ends[i] = ends
	c.mu.Unlock()

	rf := raft.Make(raft.Config{
		Me:     i,
		Peers:  peers,
		Store:  fence,
		SM:     &recorder{c: c, server: i, gen: gen},
		Timing: c.timing,
		Seed:   c.seed + int64(gen)*104729,
	})

	c.mu.Lock()
	c.rafts[i] = rf
	c.up[i] = true
	c.mu.Unlock()
	c.net.Add(i, rf)
}

// Shutdown stops every node and the monitor. It is safe to call twice.
func (c *Cluster) Shutdown() {
	c.once.Do(func() {
		close(c.stop)
		<-c.done
		c.mu.Lock()
		defer c.mu.Unlock()
		for i := range c.rafts {
			if c.rafts[i] != nil {
				c.rafts[i].Kill()
				for _, e := range c.ends[i] {
					e.Close()
				}
				c.fences[i].Fence()
			}
		}
	})
}

// N is the number of nodes.
func (c *Cluster) N() int { return c.n }

// Net exposes the network for delay, loss and duplication settings.
func (c *Cluster) Net() *labrpc.Network { return c.net }

// Raft returns node i's current instance (a restart replaces it).
func (c *Cluster) Raft(i int) *raft.Raft {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.rafts[i]
}

// State is node i's snapshot.
func (c *Cluster) State(i int) raft.State { return c.Raft(i).DebugState() }

// Disconnect cuts node i off from everyone.
func (c *Cluster) Disconnect(i int) {
	c.mu.Lock()
	c.cut[i] = true
	c.mu.Unlock()
	c.net.Disconnect(i)
}

// Connect undoes Disconnect.
func (c *Cluster) Connect(i int) {
	c.mu.Lock()
	c.cut[i] = false
	c.mu.Unlock()
	c.net.Connect(i)
}

// Partition splits the cluster into groups that cannot talk to each other.
func (c *Cluster) Partition(groups ...[]int) { c.net.Partition(groups...) }

// Heal removes every partition and reconnects every node.
func (c *Cluster) Heal() {
	c.mu.Lock()
	for i := range c.cut {
		c.cut[i] = false
	}
	c.mu.Unlock()
	c.net.Heal()
}

// Crash kills node i. Its durable store survives; everything in memory is lost.
func (c *Cluster) Crash(i int) {
	c.mu.Lock()
	if !c.up[i] {
		c.mu.Unlock()
		return
	}
	c.up[i] = false
	rf := c.rafts[i]
	ends := c.ends[i]
	fence := c.fences[i]
	c.mu.Unlock()

	c.net.Remove(i)
	for _, e := range ends {
		e.Close()
	}
	fence.Fence()
	rf.Kill()
}

// Restart boots node i again from whatever its store holds.
func (c *Cluster) Restart(i int) {
	c.mu.Lock()
	up := c.up[i]
	c.mu.Unlock()
	if up {
		c.t.Fatalf("labharness: Restart(%d) but the node is up", i)
	}
	c.start(i)
}

// Up reports whether node i is running.
func (c *Cluster) Up(i int) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.up[i]
}

// Campaign makes node i start an election now. Meant for Manual clusters.
func (c *Cluster) Campaign(i int) { c.Raft(i).DebugElect() }

// live returns the nodes that are running and not cut off, or nodes if given.
func (c *Cluster) live(nodes []int) []int {
	if len(nodes) > 0 {
		return nodes
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []int
	for i := 0; i < c.n; i++ {
		if c.up[i] && !c.cut[i] {
			out = append(out, i)
		}
	}
	return out
}

// leadersAmong returns the nodes in the set that currently claim leadership.
func (c *Cluster) leadersAmong(set []int) (ids, terms []int) {
	for _, i := range set {
		if !c.Up(i) {
			continue
		}
		term, isLeader := c.Raft(i).GetState()
		if isLeader {
			ids = append(ids, i)
			terms = append(terms, term)
		}
	}
	return ids, terms
}

// CheckOneLeader waits (up to 5 seconds) until exactly one of nodes claims to
// lead, and returns it. nodes defaults to every running, connected node. Two
// leaders in the same term fail at once; leaders in different terms are a
// stale one about to step down, so it waits.
func (c *Cluster) CheckOneLeader(nodes ...int) int {
	c.t.Helper()
	set := c.live(nodes)
	deadline := time.Now().Add(5 * time.Second)
	for {
		ids, terms := c.leadersAmong(set)
		if len(ids) == 1 {
			return ids[0]
		}
		for a := 0; a < len(ids); a++ {
			for b := a + 1; b < len(ids); b++ {
				if terms[a] == terms[b] {
					c.t.Fatalf("nodes %d and %d both lead term %d", ids[a], ids[b], terms[a])
				}
			}
		}
		if time.Now().After(deadline) {
			if len(ids) == 0 {
				c.t.Fatalf("no leader among %v after 5s", set)
			}
			c.t.Fatalf("leaders %v among %v (terms %v) did not settle on one in 5s", ids, set, terms)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// CheckNoLeader watches nodes for window and fails if any of them ever claims
// to lead. nodes defaults to every running, connected node.
func (c *Cluster) CheckNoLeader(window time.Duration, nodes ...int) {
	c.t.Helper()
	set := c.live(nodes)
	end := time.Now().Add(window)
	for time.Now().Before(end) {
		if ids, terms := c.leadersAmong(set); len(ids) > 0 {
			c.t.Fatalf("node %d leads term %d, but %v should not be able to elect a leader", ids[0], terms[0], set)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// Eventually polls cond every few milliseconds and fails with msg after d.
func (c *Cluster) Eventually(d time.Duration, msg string, cond func() bool) {
	c.t.Helper()
	deadline := time.Now().Add(d)
	for !cond() {
		if time.Now().After(deadline) {
			c.t.Fatalf("timed out after %v waiting for %s", d, msg)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// Submit gets cmd committed: it finds a leader, calls Start, and waits until at
// least want servers have applied it. It retries across leader changes for up
// to 10 seconds and returns the log index the command committed at.
func (c *Cluster) Submit(cmd string, want int) int {
	c.t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for attempt := 0; time.Now().Before(deadline); attempt++ {
		index := -1
		// Rotate the starting node: a stale leader on the wrong side of a
		// partition accepts commands that never commit, and must not be the
		// only one we ever ask.
		for k := 0; k < c.n; k++ {
			i := (attempt + k) % c.n
			if !c.Up(i) || c.isCut(i) {
				continue
			}
			if idx, _, ok := c.Raft(i).Start([]byte(cmd)); ok {
				index = idx
				break
			}
		}
		if index < 0 {
			time.Sleep(20 * time.Millisecond)
			continue
		}
		until := time.Now().Add(1500 * time.Millisecond)
		for time.Now().Before(until) {
			if n := c.CountApplied(index, cmd); n >= want {
				return index
			}
			time.Sleep(10 * time.Millisecond)
		}
		// The leader we tried may have lost its job; try again.
	}
	c.t.Fatalf("command %q was not committed on %d servers in 10s", cmd, want)
	return -1
}

func (c *Cluster) isCut(i int) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cut[i]
}

// CountApplied is how many servers have applied cmd at index. It fails if one
// applied a different command there.
func (c *Cluster) CountApplied(index int, cmd string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	n := 0
	for i := 0; i < c.n; i++ {
		if got, ok := c.applied[i][index]; ok {
			if string(got) != cmd {
				return 0
			}
			n++
		}
	}
	return n
}

// Applied is how many entries node i's state machine has applied since it last started.
func (c *Cluster) Applied(i int) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lastApply[i]
}

// AppliedCommand is the command node i applied at index, if any.
func (c *Cluster) AppliedCommand(i, index int) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	cmd, ok := c.applied[i][index]
	return string(cmd), ok
}

// Committed is the command the cluster committed at index, if any server applied one.
func (c *Cluster) Committed(index int) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	cmd, ok := c.committed[index]
	return string(cmd), ok
}

// CommittedCount is the highest index any server has applied.
func (c *Cluster) CommittedCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	max := 0
	for idx := range c.committed {
		if idx > max {
			max = idx
		}
	}
	return max
}

// LogCommands returns node i's log as strings.
func (c *Cluster) LogCommands(i int) []string {
	st := c.State(i)
	out := make([]string, len(st.Log))
	for k, e := range st.Log {
		out[k] = string(e.Command)
	}
	return out
}

// recorder is the state machine each node applies to: it records everything
// and checks it against what every other server applied.
type recorder struct {
	c      *Cluster
	server int
	gen    int
}

// Apply implements raft.StateMachine.
func (r *recorder) Apply(index int, command []byte) {
	c := r.c
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.gen[r.server] != r.gen {
		return // a node that has since crashed and restarted
	}
	if index != c.lastApply[r.server]+1 {
		c.t.Errorf("server %d applied index %d right after %d: apply must be in order, each index once",
			r.server, index, c.lastApply[r.server])
	}
	if prev, ok := c.committed[index]; ok && !bytes.Equal(prev, command) {
		c.t.Errorf("SAFETY: server %d applied %q at index %d, but %q was already committed there",
			r.server, command, index, prev)
	} else if !ok {
		c.committed[index] = append([]byte(nil), command...)
	}
	c.applied[r.server][index] = append([]byte(nil), command...)
	c.lastApply[r.server] = index
}

// Start offers cmd to the nodes in turn until one accepts as leader, retrying
// for up to 5 seconds. It does not wait for the command to commit. It returns
// the index the leader gave it and which node accepted.
func (c *Cluster) Start(cmd string) (index, leader int) {
	c.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		for i := 0; i < c.n; i++ {
			if !c.Up(i) {
				continue
			}
			if idx, _, ok := c.Raft(i).Start([]byte(cmd)); ok {
				return idx, i
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	c.t.Fatalf("no node accepted %q as leader in 5s", cmd)
	return -1, -1
}

// WaitLogs waits until every node in nodes (default: all running nodes) holds
// exactly the same log of want entries, and returns it as strings.
func (c *Cluster) WaitLogs(want int, nodes ...int) []string {
	c.t.Helper()
	if len(nodes) == 0 {
		for i := 0; i < c.n; i++ {
			if c.Up(i) {
				nodes = append(nodes, i)
			}
		}
	}
	var last []string
	c.Eventually(8*time.Second, fmt.Sprintf("nodes %v to hold the same %d-entry log", nodes, want), func() bool {
		last = c.LogCommands(nodes[0])
		if len(last) != want {
			return false
		}
		for _, i := range nodes[1:] {
			got := c.LogCommands(i)
			if len(got) != want {
				return false
			}
			for k := range got {
				if got[k] != last[k] {
					return false
				}
			}
		}
		return true
	})
	return last
}

// Leader returns a running node that currently claims leadership, preferring
// the one with the highest term.
func (c *Cluster) Leader() (int, bool) {
	best, bestTerm := -1, -1
	for i := 0; i < c.n; i++ {
		if !c.Up(i) {
			continue
		}
		if term, ok := c.Raft(i).GetState(); ok && term > bestTerm {
			best, bestTerm = i, term
		}
	}
	return best, best >= 0
}
