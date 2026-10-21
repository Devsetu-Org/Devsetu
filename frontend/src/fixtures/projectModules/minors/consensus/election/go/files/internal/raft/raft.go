// Package raft is one node of a Raft cluster.
//
// A Raft value is a state machine driven by two things: RPCs from its peers
// (RequestVote, AppendEntries) and a timer. Everything it knows lives in the
// Raft struct under one mutex, rf.mu. Functions documented "mu held" must be
// called with the lock taken and never release it, except where they say so.
package raft

import (
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/devlabs/raftkv/internal/storage"
)

// Role is what a node believes it is right now.
type Role int

const (
	Follower Role = iota
	Candidate
	Leader
)

func (r Role) String() string {
	switch r {
	case Follower:
		return "follower"
	case Candidate:
		return "candidate"
	case Leader:
		return "leader"
	default:
		return "unknown"
	}
}

// LogEntry is one command and the term in which a leader received it.
type LogEntry struct {
	Term    int
	Command []byte
}

// StateMachine is what committed commands are applied to, in log order.
type StateMachine interface {
	// Apply runs the command stored at log index (1-based). Raft calls it once
	// per committed entry, in order, from a single goroutine, without holding
	// any Raft lock.
	Apply(index int, command []byte)
}

// Peer is the way one node calls another. labrpc.ClientEnd implements it.
type Peer interface {
	Call(method string, args, reply any) bool
}

// Timing controls how fast a node reacts. Tests shrink it to run quickly.
type Timing struct {
	// ElectionMin and ElectionMax bound the randomized election timeout.
	ElectionMin, ElectionMax time.Duration
	// Heartbeat is how often a leader contacts every follower.
	Heartbeat time.Duration
	// Tick is how often the background loop wakes to look at the clock.
	Tick time.Duration
}

// DefaultTiming suits tests and the REPL: elections settle in a few hundred ms.
var DefaultTiming = Timing{
	ElectionMin: 150 * time.Millisecond,
	ElectionMax: 300 * time.Millisecond,
	Heartbeat:   30 * time.Millisecond,
	Tick:        5 * time.Millisecond,
}

// Config is everything Make needs.
type Config struct {
	// Me is this node's index in Peers.
	Me int
	// Peers[i] calls node i. Peers[Me] is never used.
	Peers []Peer
	// Store holds the state that must survive a crash (chapter 4).
	Store storage.Store
	// SM receives committed commands (chapter 3). May be nil.
	SM StateMachine
	// Timing defaults to DefaultTiming when zero.
	Timing Timing
	// Seed feeds the election-timeout randomness.
	Seed int64
}

// Raft is one node.
type Raft struct {
	mu     sync.Mutex
	peers  []Peer
	me     int
	store  storage.Store
	sm     StateMachine
	timing Timing
	rng    *rand.Rand
	dead   atomic.Bool

	// Persistent state (chapter 4 writes it to the store).
	currentTerm int
	votedFor    int        // candidate that got our vote in currentTerm, or -1
	log         []LogEntry // log[0] is a sentinel: index 0, term 0. Real entries start at 1.

	// Volatile state on every node.
	role        Role
	leaderID    int // who we last heard from as leader this term, or -1
	commitIndex int
	lastApplied int
	applyCond   *sync.Cond

	// Volatile state on leaders, rebuilt at every election.
	nextIndex  []int
	matchIndex []int

	// Clock state.
	electionDeadline time.Time
	lastBroadcast    time.Time
}

// Make starts a node. It returns at once; background goroutines do the work
// until Kill.
func Make(cfg Config) *Raft {
	if cfg.Timing == (Timing{}) {
		cfg.Timing = DefaultTiming
	}
	rf := &Raft{
		peers:    cfg.Peers,
		me:       cfg.Me,
		store:    cfg.Store,
		sm:       cfg.SM,
		timing:   cfg.Timing,
		rng:      rand.New(rand.NewSource(cfg.Seed + int64(cfg.Me)*7919)),
		votedFor: -1,
		leaderID: -1,
		log:      []LogEntry{{}},
	}
	rf.applyCond = sync.NewCond(&rf.mu)
	rf.nextIndex = make([]int, len(cfg.Peers))
	rf.matchIndex = make([]int, len(cfg.Peers))

	rf.readPersist()
	rf.mu.Lock()
	rf.resetElectionTimer()
	rf.mu.Unlock()

	go rf.ticker()
	go rf.applyLoop()
	return rf
}

// Kill stops the node's background work. Its state stays readable.
func (rf *Raft) Kill() {
	rf.dead.Store(true)
	rf.mu.Lock()
	rf.applyCond.Broadcast()
	rf.mu.Unlock()
}

func (rf *Raft) killed() bool { return rf.dead.Load() }

// GetState reports the node's current term and whether it believes it leads.
func (rf *Raft) GetState() (term int, isLeader bool) {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	return rf.currentTerm, rf.role == Leader
}

// Leader returns the node this one last heard from as leader, or -1.
func (rf *Raft) Leader() int {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	if rf.role == Leader {
		return rf.me
	}
	return rf.leaderID
}

// ticker is the clock. Every Tick it asks: if I am a leader, is it time for a
// heartbeat? If I am not, has the election timeout passed?
func (rf *Raft) ticker() {
	for !rf.killed() {
		time.Sleep(rf.timing.Tick)
		rf.mu.Lock()
		now := time.Now()
		switch {
		case rf.killed():
		case rf.role == Leader:
			if now.Sub(rf.lastBroadcast) >= rf.timing.Heartbeat {
				// A leader keeps no election deadline of its own, so keep one
				// fresh: if it is deposed it must wait a full timeout before it
				// campaigns, not fire at once on a stale deadline.
				rf.resetElectionTimer()
				rf.broadcastAppend()
			}
		case now.After(rf.electionDeadline):
			rf.startElection()
		}
		rf.mu.Unlock()
	}
}

// resetElectionTimer pushes the election deadline a random time into the
// future. Randomness is what keeps split votes from repeating forever.
// mu held.
func (rf *Raft) resetElectionTimer() {
	span := rf.timing.ElectionMax - rf.timing.ElectionMin
	d := rf.timing.ElectionMin
	if span > 0 {
		d += time.Duration(rf.rng.Int63n(int64(span)))
	}
	rf.electionDeadline = time.Now().Add(d)
}

// lastLogIndex is the index of the last entry (0 for an empty log). mu held.
func (rf *Raft) lastLogIndex() int { return len(rf.log) - 1 }

// lastLogTerm is the term of the last entry (0 for an empty log). mu held.
func (rf *Raft) lastLogTerm() int { return rf.log[len(rf.log)-1].Term }

// majority is how many nodes make a quorum. mu held.
func (rf *Raft) majority() int { return len(rf.peers)/2 + 1 }

// resetLeaderProgress points every follower's nextIndex just past our log and
// forgets what we knew about their matchIndex. Called when we win. mu held.
func (rf *Raft) resetLeaderProgress() {
	for i := range rf.peers {
		rf.nextIndex[i] = rf.lastLogIndex() + 1
		rf.matchIndex[i] = 0
	}
}
