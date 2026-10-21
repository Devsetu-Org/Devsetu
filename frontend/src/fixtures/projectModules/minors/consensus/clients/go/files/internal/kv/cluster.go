package kv

import (
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/devlabs/raftkv/internal/labrpc"
	"github.com/devlabs/raftkv/internal/raft"
	"github.com/devlabs/raftkv/internal/storage"
)

// ClusterOption configures StartCluster.
type ClusterOption func(*clusterOptions)

type clusterOptions struct {
	timing raft.Timing
	seed   int64
	dir    string
}

// WithTiming overrides the Raft timing.
func WithTiming(t raft.Timing) ClusterOption { return func(o *clusterOptions) { o.timing = t } }

// WithSeed sets the random seed.
func WithSeed(seed int64) ClusterOption { return func(o *clusterOptions) { o.seed = seed } }

// WithDir keeps each server's Raft state on disk under dir instead of memory.
func WithDir(dir string) ClusterOption { return func(o *clusterOptions) { o.dir = dir } }

// Cluster is N servers on one in-process network.
type Cluster struct {
	n       int
	net     *labrpc.Network
	opts    clusterOptions
	mu      sync.Mutex
	srv     []*Server
	ends    [][]*labrpc.ClientEnd
	durable []storage.Store
	fences  []*storage.Fenced
	gen     []int
	clerks  int
}

// StartCluster boots n servers and returns once they are running. A leader
// appears a few hundred milliseconds later.
func StartCluster(n int, opts ...ClusterOption) (*Cluster, error) {
	o := clusterOptions{
		timing: raft.Timing{
			ElectionMin: 120 * time.Millisecond,
			ElectionMax: 240 * time.Millisecond,
			Heartbeat:   25 * time.Millisecond,
			Tick:        4 * time.Millisecond,
		},
		seed: 1,
	}
	for _, opt := range opts {
		opt(&o)
	}
	c := &Cluster{
		n:       n,
		net:     labrpc.NewNetwork(o.seed),
		opts:    o,
		srv:     make([]*Server, n),
		ends:    make([][]*labrpc.ClientEnd, n),
		durable: make([]storage.Store, n),
		fences:  make([]*storage.Fenced, n),
		gen:     make([]int, n),
	}
	for i := 0; i < n; i++ {
		if o.dir != "" {
			f, err := storage.NewFile(filepath.Join(o.dir, fmt.Sprintf("server-%d", i)))
			if err != nil {
				return nil, err
			}
			c.durable[i] = f
		} else {
			c.durable[i] = storage.NewMem()
		}
	}
	for i := 0; i < n; i++ {
		c.boot(i)
	}
	return c, nil
}

func (c *Cluster) boot(i int) {
	c.mu.Lock()
	c.gen[i]++
	gen := c.gen[i]
	c.fences[i] = storage.NewFenced(c.durable[i])
	ends := make([]*labrpc.ClientEnd, c.n)
	peers := make([]raft.Peer, c.n)
	for j := range ends {
		ends[j] = c.net.End(i, j)
		peers[j] = ends[j]
	}
	c.ends[i] = ends
	fence := c.fences[i]
	c.mu.Unlock()

	s := StartServer(i, peers, fence, c.opts.timing, c.opts.seed+int64(gen)*104729)

	c.mu.Lock()
	c.srv[i] = s
	c.mu.Unlock()
	c.net.Add(i, s)
}

// N is the number of servers.
func (c *Cluster) N() int { return c.n }

// Net exposes the network for loss, delay and duplication.
func (c *Cluster) Net() *labrpc.Network { return c.net }

// Server returns server i's current instance, or nil while it is crashed.
func (c *Cluster) Server(i int) *Server {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.srv[i]
}

// NewClerk returns a client wired to every server. Clients are outside the
// cluster: partitions do not cut them off from any server that is up.
func (c *Cluster) NewClerk() *Clerk {
	c.mu.Lock()
	c.clerks++
	from := labrpc.ExternalBase + c.clerks
	c.mu.Unlock()
	ends := make([]*labrpc.ClientEnd, c.n)
	for i := range ends {
		ends[i] = c.net.End(from, i)
	}
	return NewClerk(ends)
}

// Partition splits the servers into groups that cannot talk to each other.
func (c *Cluster) Partition(groups ...[]int) { c.net.Partition(groups...) }

// Heal removes every partition and reconnects every server.
func (c *Cluster) Heal() { c.net.Heal() }

// Disconnect cuts server i off from everyone, clients included.
func (c *Cluster) Disconnect(i int) { c.net.Disconnect(i) }

// Connect undoes Disconnect.
func (c *Cluster) Connect(i int) { c.net.Connect(i) }

// Crash kills server i. Its Raft state stays on its store; the key/value map,
// which lives in memory, is lost and rebuilt from the log on Restart.
func (c *Cluster) Crash(i int) {
	c.mu.Lock()
	s, ends, fence := c.srv[i], c.ends[i], c.fences[i]
	c.srv[i] = nil
	c.mu.Unlock()
	if s == nil {
		return
	}
	c.net.Remove(i)
	for _, e := range ends {
		e.Close()
	}
	fence.Fence()
	s.Kill()
}

// Restart boots server i again from its stored Raft state.
func (c *Cluster) Restart(i int) { c.boot(i) }

// Leader returns the running server with the highest-term leadership claim.
func (c *Cluster) Leader() (int, bool) {
	best, bestTerm := -1, -1
	for i := 0; i < c.n; i++ {
		s := c.Server(i)
		if s == nil {
			continue
		}
		if term, ok := s.Raft().GetState(); ok && term > bestTerm {
			best, bestTerm = i, term
		}
	}
	return best, best >= 0
}

// Shutdown stops every server.
func (c *Cluster) Shutdown() {
	for i := 0; i < c.n; i++ {
		c.Crash(i)
	}
}
