// Package dispatch is Fleetline's in-process trip handler for ridernet labs.
package dispatch

import (
	"encoding/gob"
	"fmt"
	"sync/atomic"

	"github.com/devlabs/ridernet/internal/netsim"
)

func init() {
	gob.Register(TripHopArgs{})
	gob.Register(TripHopReply{})
}

// TripHopArgs is one step on the open-trip path (request, match, confirm, …).
type TripHopArgs struct {
	TripID string
	Step   string
}

// TripHopReply acknowledges a hop.
type TripHopReply struct {
	TripID string
	Step   string
	OK     bool
}

// Server answers Dispatch.TripHop RPCs.
type Server struct {
	seq atomic.Uint64
}

// NewServer returns a dispatch server.
func NewServer() *Server {
	return &Server{}
}

// Register wires Dispatch.TripHop onto net.
func (s *Server) Register(net *netsim.Network) {
	net.Register("Dispatch.TripHop", func(args any) (any, error) {
		a, err := asTripHopArgs(args)
		if err != nil {
			return nil, err
		}
		if a.TripID == "" || a.Step == "" {
			return nil, fmt.Errorf("invalid trip hop")
		}
		_ = s.seq.Add(1)
		return TripHopReply{TripID: a.TripID, Step: a.Step, OK: true}, nil
	})
}

func asTripHopArgs(args any) (TripHopArgs, error) {
	switch v := args.(type) {
	case TripHopArgs:
		return v, nil
	case *TripHopArgs:
		if v == nil {
			return TripHopArgs{}, fmt.Errorf("nil TripHopArgs")
		}
		return *v, nil
	default:
		return TripHopArgs{}, fmt.Errorf("bad args type %T", args)
	}
}
