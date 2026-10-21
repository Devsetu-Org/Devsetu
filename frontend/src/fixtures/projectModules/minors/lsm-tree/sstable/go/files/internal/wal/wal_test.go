package wal

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/lsmkv/internal/memtable"
)

func put(k, v string) Record {
	return Record{Kind: memtable.KindValue, Key: []byte(k), Value: []byte(v)}
}

func del(k string) Record {
	return Record{Kind: memtable.KindTombstone, Key: []byte(k)}
}

func writeLog(t *testing.T, path string, recs ...Record) {
	t.Helper()
	w, err := Create(path, SyncNever)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range recs {
		if err := w.Append(r); err != nil {
			t.Fatalf("Append: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
}

func replayAll(t *testing.T, path string) ([]Record, int64) {
	t.Helper()
	var got []Record
	good, err := Replay(path, func(r Record) error {
		got = append(got, Record{
			Kind:  r.Kind,
			Key:   append([]byte(nil), r.Key...),
			Value: append([]byte(nil), r.Value...),
		})
		return nil
	})
	if err != nil {
		t.Fatalf("Replay: %v", err)
	}
	return got, good
}

func sameRecords(t *testing.T, got, want []Record) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("replayed %d records, want %d", len(got), len(want))
	}
	for i := range want {
		g, w := got[i], want[i]
		if g.Kind != w.Kind || !bytes.Equal(g.Key, w.Key) || !bytes.Equal(g.Value, w.Value) {
			t.Fatalf("record %d = {%v %q %q}, want {%v %q %q}", i, g.Kind, g.Key, g.Value, w.Kind, w.Key, w.Value)
		}
	}
}

func TestEncodeLayout(t *testing.T) {
	b := encode(nil, put("k", "vv"))
	// payload: kind(1) + keyLen(1) + "k" + valueLen(1) + "vv" = 6 bytes
	if len(b) != headerSize+6 {
		t.Fatalf("encoded length = %d, want %d (8-byte header + 6-byte payload)", len(b), headerSize+6)
	}
	if n := binary.LittleEndian.Uint32(b[4:8]); n != 6 {
		t.Fatalf("length field = %d, want 6 (payload bytes only)", n)
	}
	wantPayload := []byte{byte(memtable.KindValue), 1, 'k', 2, 'v', 'v'}
	if !bytes.Equal(b[headerSize:], wantPayload) {
		t.Fatalf("payload = %v, want %v", b[headerSize:], wantPayload)
	}
	if sum := binary.LittleEndian.Uint32(b[0:4]); sum == 0 {
		t.Fatal("checksum field is zero; it should be the CRC-32C of the payload")
	}
	// encode appends; it must not overwrite what dst already holds.
	prefix := []byte("keep")
	b2 := encode(append([]byte(nil), prefix...), put("k", "vv"))
	if !bytes.Equal(b2[:4], prefix) || !bytes.Equal(b2[4:], b) {
		t.Fatal("encode must append to dst, leaving existing bytes alone")
	}
}

func TestRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	want := []Record{
		put("order:1", "pending"),
		put("order:2", ""),
		del("order:1"),
		put("bin\x00key", "\xff\x00\x01"),
		put("big", string(bytes.Repeat([]byte("x"), 100_000))),
	}
	writeLog(t, path, want...)
	got, good := replayAll(t, path)
	sameRecords(t, got, want)
	st, _ := os.Stat(path)
	if good != st.Size() {
		t.Fatalf("good = %d, want the whole file (%d bytes)", good, st.Size())
	}
}

func TestMissingFileIsEmpty(t *testing.T) {
	got, good := replayAll(t, filepath.Join(t.TempDir(), "nope.log"))
	if len(got) != 0 || good != 0 {
		t.Fatalf("missing log: %d records, good=%d; want 0 and 0", len(got), good)
	}
}

func TestAppendIsNotBuffered(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	w, err := Create(path, SyncNever)
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	if err := w.Append(put("a", "1")); err != nil {
		t.Fatal(err)
	}
	// Without Close: the record must already be in the file, or a crash
	// right after an acknowledged write would lose it.
	got, _ := replayAll(t, path)
	sameRecords(t, got, []Record{put("a", "1")})
	if w.Size() != int64(len(encode(nil, put("a", "1")))) {
		t.Fatalf("Size = %d after one append, want %d", w.Size(), len(encode(nil, put("a", "1"))))
	}
}

func TestTornTailAtEveryByte(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "wal.log")
	first := []Record{put("a", "1"), del("b")}
	last := put("c", "the last write, cut short")
	writeLog(t, path, append(first, last)...)
	full, _ := os.ReadFile(path)
	keep := len(full) - len(encode(nil, last))

	for cut := 1; cut < len(encode(nil, last)); cut++ {
		torn := filepath.Join(dir, fmt.Sprintf("torn-%d.log", cut))
		if err := os.WriteFile(torn, full[:len(full)-cut], 0o644); err != nil {
			t.Fatal(err)
		}
		got, good := replayAll(t, torn)
		if len(got) != len(first) {
			t.Fatalf("cut %d bytes off the last record: replayed %d records, want %d", cut, len(got), len(first))
		}
		sameRecords(t, got, first)
		if good != int64(keep) {
			t.Fatalf("cut %d bytes: good = %d, want %d (end of the last intact record)", cut, good, keep)
		}
	}
}

func TestChecksumMismatchStopsReplay(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	writeLog(t, path, put("a", "1"), put("b", "2"), put("c", "3"))
	data, _ := os.ReadFile(path)
	data[len(data)-1] ^= 0xff // flip a bit in the last value
	os.WriteFile(path, data, 0o644)
	got, _ := replayAll(t, path)
	sameRecords(t, got, []Record{put("a", "1"), put("b", "2")})
}

func TestHugeLengthIsATornTail(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	writeLog(t, path, put("a", "1"))
	data, _ := os.ReadFile(path)
	garbage := make([]byte, headerSize)
	binary.LittleEndian.PutUint32(garbage[4:], 0xfffffff0)
	os.WriteFile(path, append(data, garbage...), 0o644)
	got, good := replayAll(t, path)
	sameRecords(t, got, []Record{put("a", "1")})
	if good != int64(len(data)) {
		t.Fatalf("good = %d, want %d", good, len(data))
	}
}

func TestReplayStopsOnCallbackError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	writeLog(t, path, put("a", "1"), put("b", "2"))
	boom := fmt.Errorf("boom")
	calls := 0
	_, err := Replay(path, func(Record) error { calls++; return boom })
	if err != boom || calls != 1 {
		t.Fatalf("Replay returned %v after %d calls; want the callback's error after 1 call", err, calls)
	}
}
