package kv

import (
	"errors"
	"sync/atomic"
	"time"

	"github.com/devlabs/raftkv/internal/labrpc"
)

// ErrUnavailable means no server committed the request before the clerk's
// Timeout. The request may or may not have taken effect.
var ErrUnavailable = errors.New("kv: no leader committed the request in time")

var nextClientID atomic.Int64

// Clerk is a client. It talks to the cluster through one request at a time:
// do not share a Clerk between goroutines.
type Clerk struct {
	// Timeout bounds one Put, Get or Delete including all retries.
	Timeout time.Duration

	ends   []*labrpc.ClientEnd
	id     int64
	seq    int64
	leader int // the server we try first
}

// NewClerk returns a client that calls servers through ends.
func NewClerk(ends []*labrpc.ClientEnd) *Clerk {
	return &Clerk{Timeout: 10 * time.Second, ends: ends, id: nextClientID.Add(1)}
}

// Put sets key to value.
func (ck *Clerk) Put(key, value []byte) error {
	_, err := ck.do(Op{Kind: OpPut, Key: key, Value: value})
	return err
}

// Delete removes key. Deleting a missing key is not an error.
func (ck *Clerk) Delete(key []byte) error {
	_, err := ck.do(Op{Kind: OpDelete, Key: key})
	return err
}

// Get returns the value of key and whether it exists.
func (ck *Clerk) Get(key []byte) (value []byte, ok bool, err error) {
	res, err := ck.do(Op{Kind: OpGet, Key: key})
	return res.Value, res.Found, err
}

// do sends op until some leader commits it or Timeout passes.
func (ck *Clerk) do(op Op) (Result, error) {
	ck.seq++
	op.ClientID, op.Seq = ck.id, ck.seq
	deadline := time.Now().Add(ck.Timeout)
	failedAt := map[int]int{} // server -> attempt number it last failed on
	for attempt := 1; time.Now().Before(deadline); attempt++ {
		server := ck.leader
		var reply ExecuteReply
		ok := ck.ends[server].Call("KV.Execute", &ExecuteArgs{Op: op}, &reply)
		if ok && reply.Err == "" {
			return Result{Value: reply.Value, Found: reply.Found}, nil
		}
		// Wrong server, lost message or timeout. The same (ClientID, Seq) goes
		// out again, so a request that did commit is not run twice.
		failedAt[server] = attempt
		next := (server + 1) % len(ck.ends)
		// A redirect is only a hint: a follower may still point at a leader
		// that has since been deposed. Follow it unless that server just failed.
		if ok && reply.Err == ErrNotLeader && reply.Leader >= 0 && reply.Leader < len(ck.ends) {
			if last, bad := failedAt[reply.Leader]; !bad || attempt-last >= len(ck.ends) {
				next = reply.Leader
			}
		}
		ck.leader = next
		if attempt%len(ck.ends) == 0 {
			time.Sleep(25 * time.Millisecond) // everyone said no: let an election finish
		}
	}
	return Result{}, ErrUnavailable
}
