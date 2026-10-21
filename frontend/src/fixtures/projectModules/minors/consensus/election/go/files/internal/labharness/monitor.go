package labharness

import (
	"time"

	"github.com/devlabs/raftkv/internal/raft"
)

// monitor samples every running node a few times per election timeout and
// reports safety violations through t.Errorf.
func (c *Cluster) monitor() {
	defer close(c.done)
	tick := time.NewTicker(8 * time.Millisecond)
	defer tick.Stop()
	round := 0
	for {
		select {
		case <-c.stop:
			return
		case <-tick.C:
		}
		var states []raft.State
		for i := 0; i < c.n; i++ {
			if c.Up(i) {
				states = append(states, c.Raft(i).DebugState())
			}
		}
		c.checkLeaders(states)
		if round%4 == 0 {
			c.checkLogMatching(states)
		}
		round++
	}
}

func (c *Cluster) checkLeaders(states []raft.State) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, st := range states {
		if st.Role != raft.Leader {
			continue
		}
		if prev, ok := c.leaders[st.Term]; ok && prev != st.ID {
			c.t.Errorf("SAFETY: nodes %d and %d were both leader of term %d", prev, st.ID, st.Term)
		}
		c.leaders[st.Term] = st.ID
	}
}

// checkLogMatching enforces the Log Matching property: if two logs hold an
// entry with the same index and term, the logs are identical up to that index.
func (c *Cluster) checkLogMatching(states []raft.State) {
	for a := 0; a < len(states); a++ {
		for b := a + 1; b < len(states); b++ {
			la, lb := states[a].Log, states[b].Log
			top := min(len(la), len(lb))
			match := 0
			for k := top; k >= 1; k-- {
				if la[k-1].Term == lb[k-1].Term {
					match = k
					break
				}
			}
			for k := 1; k <= match; k++ {
				if la[k-1].Term != lb[k-1].Term || string(la[k-1].Command) != string(lb[k-1].Command) {
					c.t.Errorf("SAFETY: logs of nodes %d and %d agree at index %d (term %d) but differ at index %d",
						states[a].ID, states[b].ID, match, la[match-1].Term, k)
					return
				}
			}
		}
	}
}
