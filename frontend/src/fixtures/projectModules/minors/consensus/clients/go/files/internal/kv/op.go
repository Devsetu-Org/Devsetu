// Package kv is the replicated key/value store: a state machine on top of
// Raft, a server that turns client requests into log entries, and a client
// that finds the leader.
package kv

import (
	"bytes"
	"encoding/gob"
)

// OpKind is what an Op does.
type OpKind uint8

const (
	OpGet OpKind = iota + 1
	OpPut
	OpDelete
)

// Op is one client request, and the command stored in the Raft log. ClientID
// and Seq identify it: a client that retries sends the same pair again, and
// the state machine uses it to avoid running the request twice.
type Op struct {
	Kind     OpKind
	Key      []byte
	Value    []byte
	ClientID int64
	Seq      int64
}

func encodeOp(op Op) []byte {
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(op); err != nil {
		panic("kv: encode op: " + err.Error())
	}
	return buf.Bytes()
}

func decodeOp(data []byte) (Op, error) {
	var op Op
	err := gob.NewDecoder(bytes.NewReader(data)).Decode(&op)
	return op, err
}

// Errors carried in ExecuteReply.Err. Empty means success.
const (
	ErrNotLeader = "not leader"
	ErrTimeout   = "timeout"
)

// ExecuteArgs is the client -> server request.
type ExecuteArgs struct {
	Op Op
}

// ExecuteReply is the server -> client answer.
type ExecuteReply struct {
	Err    string
	Value  []byte // Get only
	Found  bool   // Get only
	Leader int    // on ErrNotLeader: who this server thinks leads, or -1
}
