package labrpc

import (
	"sync/atomic"
	"testing"
	"time"
)

type echo struct{ calls atomic.Int64 }

type msg struct{ N int }

func (e *echo) Handle(method string, args []byte) ([]byte, error) {
	e.calls.Add(1)
	var m msg
	if err := Decode(args, &m); err != nil {
		return nil, err
	}
	m.N++
	return Encode(m), nil
}

func TestCallRoundTrip(t *testing.T) {
	net := NewNetwork(1)
	net.Add(1, &echo{})
	var r msg
	if !net.End(0, 1).Call("echo", &msg{N: 41}, &r) || r.N != 42 {
		t.Fatalf("Call = %+v", r)
	}
}

func TestDisconnectAndPartition(t *testing.T) {
	net := NewNetwork(1)
	for i := 0; i < 3; i++ {
		net.Add(i, &echo{})
	}
	net.Disconnect(2)
	if net.End(0, 2).Call("echo", &msg{}, &msg{}) {
		t.Fatal("call to a disconnected node succeeded")
	}
	net.Heal()
	net.Partition([]int{0, 1}, []int{2})
	if net.End(0, 2).Call("echo", &msg{}, &msg{}) {
		t.Fatal("call across a partition succeeded")
	}
	if !net.End(0, 1).Call("echo", &msg{}, &msg{}) {
		t.Fatal("call inside a partition failed")
	}
	net.Remove(1)
	if net.End(0, 1).Call("echo", &msg{}, &msg{}) {
		t.Fatal("call to a removed node succeeded")
	}
}

func TestClosedEndFails(t *testing.T) {
	net := NewNetwork(1)
	net.Add(1, &echo{})
	end := net.End(0, 1)
	end.Close()
	if end.Call("echo", &msg{}, &msg{}) {
		t.Fatal("closed end still delivers")
	}
}

func TestDropAndDuplicate(t *testing.T) {
	net := NewNetwork(7)
	h := &echo{}
	net.Add(1, h)
	net.SetUnreliable(0.5, 0)
	ok := 0
	for i := 0; i < 80; i++ {
		if net.End(0, 1).Call("echo", &msg{}, &msg{}) {
			ok++
		}
	}
	if ok == 0 || ok == 80 {
		t.Fatalf("with 50%% drop, %d/80 calls succeeded", ok)
	}
	net.SetUnreliable(0, 1)
	before := h.calls.Load()
	for i := 0; i < 20; i++ {
		net.End(0, 1).Call("echo", &msg{}, &msg{})
	}
	time.Sleep(20 * time.Millisecond)
	if got := h.calls.Load() - before; got != 40 {
		t.Fatalf("with dup=1 handler ran %d times for 20 calls, want 40", got)
	}
}
