package wal

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"os"
	"path/filepath"
	"testing"
)

func pageRec(no uint32, fill byte) Record {
	return Record{Kind: KindPage, Page: no, Data: bytes.Repeat([]byte{fill}, 4092)}
}

func replayAll(t *testing.T, path string) (recs []Record, ends []int64, good int64) {
	t.Helper()
	good, err := Replay(path, func(r Record, end int64) error {
		recs = append(recs, r)
		ends = append(ends, end)
		return nil
	})
	if err != nil {
		t.Fatalf("Replay: %v", err)
	}
	return
}

func TestEncodeFrame(t *testing.T) {
	r := Record{Kind: KindPage, Page: 9, Data: []byte("hello")}
	prefix := []byte("keep-me")
	out := encode(append([]byte(nil), prefix...), r)
	if !bytes.HasPrefix(out, prefix) {
		t.Fatal("encode must append: bytes already in dst were changed")
	}
	frame := out[len(prefix):]
	payload := appendPayload(nil, r)
	if len(frame) != headerSize+len(payload) {
		t.Fatalf("frame is %d bytes, want %d (8-byte header + payload)", len(frame), headerSize+len(payload))
	}
	if got, want := binary.LittleEndian.Uint32(frame[0:4]), crc32.Checksum(payload, crc32.MakeTable(crc32.Castagnoli)); got != want {
		t.Fatalf("checksum field = %#x, want CRC-32C of the payload %#x", got, want)
	}
	if got := binary.LittleEndian.Uint32(frame[4:8]); int(got) != len(payload) {
		t.Fatalf("length field = %d, want %d", got, len(payload))
	}
	if !bytes.Equal(frame[headerSize:], payload) {
		t.Fatal("payload bytes differ")
	}
}

func TestAppendReplayRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	w, err := Create(path, SyncNever)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Append(pageRec(1, 'a'), MetaRecord(1, 2, 0), CommitRecord()); err != nil {
		t.Fatalf("Append: %v", err)
	}
	if err := w.Append(pageRec(2, 'b'), CommitRecord()); err != nil {
		t.Fatalf("Append: %v", err)
	}
	size := w.Size()
	w.Close()

	recs, ends, good := replayAll(t, path)
	if len(recs) != 5 {
		t.Fatalf("replayed %d records, want 5", len(recs))
	}
	if good != size || ends[4] != size {
		t.Fatalf("good = %d, last end = %d, want the log size %d", good, ends[4], size)
	}
	if recs[0].Kind != KindPage || recs[0].Page != 1 || !bytes.Equal(recs[0].Data, pageRec(1, 'a').Data) {
		t.Fatal("first record did not round trip")
	}
	root, count, free, err := recs[1].Meta()
	if err != nil || root != 1 || count != 2 || free != 0 {
		t.Fatalf("meta = %d %d %d, %v", root, count, free, err)
	}
	if recs[2].Kind != KindCommit || recs[3].Page != 2 {
		t.Fatalf("records out of order: %+v", recs)
	}
	for i := 1; i < len(ends); i++ {
		if ends[i] <= ends[i-1] {
			t.Fatalf("end offsets must increase: %v", ends)
		}
	}
}

func TestDurableTracksFsync(t *testing.T) {
	dir := t.TempDir()
	w, _ := Create(filepath.Join(dir, "a.log"), SyncAlways)
	w.Append(pageRec(1, 'x'))
	if w.Durable() != w.Size() || w.Size() == 0 {
		t.Fatalf("SyncAlways: durable %d, size %d; a returned Append must be durable", w.Durable(), w.Size())
	}
	w.Close()

	w, _ = Create(filepath.Join(dir, "b.log"), SyncNever)
	w.Append(pageRec(1, 'x'))
	if w.Durable() != 0 || w.Size() == 0 {
		t.Fatalf("SyncNever: durable %d, size %d; nothing was fsynced yet", w.Durable(), w.Size())
	}
	if err := w.Sync(); err != nil || w.Durable() != w.Size() {
		t.Fatalf("after Sync: durable %d, size %d, err %v", w.Durable(), w.Size(), err)
	}
	w.Close()
}

func buildLog(t *testing.T, n int) (path string, ends []int64) {
	t.Helper()
	path = filepath.Join(t.TempDir(), "wal.log")
	w, _ := Create(path, SyncNever)
	for i := 0; i < n; i++ {
		if err := w.Append(pageRec(uint32(i+1), byte('a'+i))); err != nil {
			t.Fatal(err)
		}
		ends = append(ends, w.Size())
	}
	w.Close()
	return
}

func TestReplayStopsAtEveryTornTail(t *testing.T) {
	path, ends := buildLog(t, 3)
	full, _ := os.ReadFile(path)
	// Cut the file at every byte inside the last record: the first two
	// records must always come back, and the third never.
	for cut := ends[1]; cut < ends[2]; cut++ {
		if err := os.WriteFile(path, full[:cut], 0o644); err != nil {
			t.Fatal(err)
		}
		recs, _, good := replayAll(t, path)
		if len(recs) != 2 || good != ends[1] {
			t.Fatalf("cut at %d: %d records, good=%d; want 2 records, good=%d", cut, len(recs), good, ends[1])
		}
	}
}

func TestReplayStopsAtBadChecksum(t *testing.T) {
	path, ends := buildLog(t, 3)
	data, _ := os.ReadFile(path)
	data[ends[0]+headerSize+20] ^= 0xFF // a byte inside record 2's payload
	os.WriteFile(path, data, 0o644)
	recs, _, good := replayAll(t, path)
	if len(recs) != 1 || good != ends[0] {
		t.Fatalf("%d records, good=%d; want 1 record, good=%d (a bad record ends the log)", len(recs), good, ends[0])
	}
}

func TestReplayMissingAndEmptyFile(t *testing.T) {
	dir := t.TempDir()
	if good, err := Replay(filepath.Join(dir, "nope.log"), func(Record, int64) error { return nil }); err != nil || good != 0 {
		t.Fatalf("missing file: good=%d err=%v", good, err)
	}
	empty := filepath.Join(dir, "empty.log")
	os.WriteFile(empty, nil, 0o644)
	if recs, _, good := replayAll(t, empty); len(recs) != 0 || good != 0 {
		t.Fatalf("empty file: %d records, good=%d", len(recs), good)
	}
}

func TestReplayStopsOnCallbackError(t *testing.T) {
	path, ends := buildLog(t, 3)
	boom := errors.New("boom")
	calls := 0
	good, err := Replay(path, func(Record, int64) error {
		calls++
		if calls == 2 {
			return boom
		}
		return nil
	})
	if !errors.Is(err, boom) || good != ends[0] {
		t.Fatalf("good=%d err=%v; want good=%d (before the failing record) and the callback's error", good, err, ends[0])
	}
}

func TestOpenAppendCutsTheTail(t *testing.T) {
	path, ends := buildLog(t, 2)
	f, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	f.Write([]byte("half a record of garbage"))
	f.Close()

	_, _, good := replayAll(t, path)
	if good != ends[1] {
		t.Fatalf("good = %d, want %d", good, ends[1])
	}
	w, err := OpenAppend(path, good, SyncNever)
	if err != nil {
		t.Fatal(err)
	}
	if w.Size() != good {
		t.Fatalf("Size = %d, want %d", w.Size(), good)
	}
	if err := w.Append(pageRec(9, 'z')); err != nil {
		t.Fatal(err)
	}
	w.Close()
	recs, _, _ := replayAll(t, path)
	if len(recs) != 3 || recs[2].Page != 9 {
		t.Fatalf("after cutting and appending, replay saw %d records; the new one must follow the good prefix directly", len(recs))
	}
}

func TestRewindAndReset(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wal.log")
	w, _ := Create(path, SyncNever)
	w.Append(pageRec(1, 'a'))
	mark := w.Size()
	w.Append(pageRec(2, 'b'))
	if err := w.Rewind(mark); err != nil || w.Size() != mark {
		t.Fatalf("Rewind: size %d, err %v", w.Size(), err)
	}
	w.Append(pageRec(3, 'c'))
	recs, _, _ := replayAll(t, path)
	if len(recs) != 2 || recs[1].Page != 3 {
		t.Fatalf("after Rewind and Append: %+v", recs)
	}
	if err := w.Reset(); err != nil || w.Size() != 0 {
		t.Fatalf("Reset: size %d, err %v", w.Size(), err)
	}
	w.Append(pageRec(4, 'd'))
	w.Close()
	recs, _, _ = replayAll(t, path)
	if len(recs) != 1 || recs[0].Page != 4 {
		t.Fatalf("after Reset: %+v", recs)
	}
}

func TestMetaRecordRejectsOtherKinds(t *testing.T) {
	if _, _, _, err := pageRec(1, 'a').Meta(); err == nil {
		t.Fatal("Meta on a page record should fail")
	}
}
